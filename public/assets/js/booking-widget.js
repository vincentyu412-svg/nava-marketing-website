/**
 * Gym Grow — Booking Widget
 * Two-step calendar: contact form → pick a day & time.
 * Sends webhooks to GoHighLevel on each step.
 */
(function () {
    'use strict';

    /* ── CONFIG ── */
    var WEBHOOK_CONTACT = 'https://services.leadconnectorhq.com/hooks/nj64FkmpN1Ul4VI6hosy/webhook-trigger/49ff8b4b-049f-43cd-a11f-6a0506448c55'; /* GoHighLevel webhook URL — fires when visitor submits contact details */
    var WEBHOOK_BOOKING = 'https://services.leadconnectorhq.com/hooks/nj64FkmpN1Ul4VI6hosy/webhook-trigger/e168511d-2712-46a9-918f-108867edfe99'; /* GoHighLevel webhook URL — fires when visitor confirms a booking      */

    /* Google Apps Script URL — returns busy times from your Google Calendar */
    var GCAL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzl5dD_3WOxEBxjp9naQoxvSxSTSdMZ3jo8Eu2XllRKKzM1xwobGnqd8rEoy9OKZNHj/exec';

    /* Available time slots in 24 h format — 1:00 AM to 11:00 PM */
    var TIME_SLOTS = [
        '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
        '04:00', '04:30', '05:00', '05:30', '06:00', '06:30',
        '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
        '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
        '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
        '22:00', '22:30', '23:00'
    ];

    var MAX_DAYS_AHEAD = 60;                /* How far out visitors can book */
    var AVAILABLE_DAYS = [0, 1, 2, 3, 4, 5, 6]; /* All days — Google Calendar controls actual availability */

    /* ── ELEMENTS ── */
    var modal = document.getElementById('popup-modal');
    if (!modal) return;
    var backdrop = modal.querySelector('.modal__backdrop');
    var closeBtn = modal.querySelector('.modal__close');
    var step1 = document.getElementById('bw-step-1');
    var calendar = document.getElementById('bw-calendar');
    var blurOverlay = document.getElementById('bw-blur-overlay');
    var contactForm = document.getElementById('bw-contact-form');
    var calGrid = document.getElementById('bw-cal-grid');
    var monthLabel = document.getElementById('bw-month-label');
    var prevBtn = document.getElementById('bw-prev-month');
    var nextBtn = document.getElementById('bw-next-month');
    var timesWrap = document.getElementById('bw-times');
    var timesGrid = document.getElementById('bw-times-grid');
    var timesLabel = document.getElementById('bw-times-label');
    var confirmBtn = document.getElementById('bw-confirm');
    var confirmedPanel = document.getElementById('bw-confirmed');
    var confirmedDetails = document.getElementById('bw-confirmed-details');
    var progressSteps = modal.querySelectorAll('.bw-progress__step');

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);
    var viewMonth = today.getMonth();
    var viewYear = today.getFullYear();

    var contactData = null;
    var selectedDate = null;
    var selectedTime = null;
    var busyTimes = []; /* Array of { start: Date, end: Date } from Google Calendar */

    /* ── HELPERS ── */
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function formatDate(d) {
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatTime12(t) {
        var parts = t.split(':');
        var h = parseInt(parts[0], 10);
        var m = parts[1];
        var ampm = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return h + ':' + m + ' ' + ampm;
    }

    function setProgress(step) {
        progressSteps.forEach(function (el) {
            var s = parseInt(el.getAttribute('data-step'), 10);
            el.classList.toggle('bw-progress__step--active', s <= step);
            el.classList.toggle('bw-progress__step--done', s < step);
        });
    }

    /* ── WEBHOOK SENDER ── */
    function sendWebhook(url, payload) {
        if (!url) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(payload));
        } catch (e) { /* silent fail */ }
    }

    /* ── GOOGLE CALENDAR BUSY TIMES ── */
    function fetchBusyTimes() {
        if (!GCAL_SCRIPT_URL) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', GCAL_SCRIPT_URL, true);
            xhr.onload = function () {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        busyTimes = (data.busy || []).map(function (b) {
                            return { start: new Date(b.start), end: new Date(b.end) };
                        });
                    } catch (e) { busyTimes = []; }
                }
            };
            xhr.onerror = function () { busyTimes = []; };
            xhr.send();
        } catch (e) { busyTimes = []; }
    }

    /* Check if a specific date+time slot overlaps any busy period */
    function isSlotBusy(date, timeStr) {
        var parts = timeStr.split(':');
        var slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
            parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
        var slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000); /* 30-min slot */

        for (var i = 0; i < busyTimes.length; i++) {
            /* Overlap: slot starts before busy ends AND slot ends after busy starts */
            if (slotStart < busyTimes[i].end && slotEnd > busyTimes[i].start) {
                return true;
            }
        }
        return false;
    }

    /* Check if an entire day has zero available slots */
    function isDayFullyBooked(date) {
        for (var i = 0; i < TIME_SLOTS.length; i++) {
            if (!isSlotBusy(date, TIME_SLOTS[i])) return false;
        }
        return true;
    }

    /* ── CALENDAR RENDER ── */
    function renderCalendar() {
        calGrid.innerHTML = '';
        monthLabel.textContent = MONTHS[viewMonth] + ' ' + viewYear;
        var first = new Date(viewYear, viewMonth, 1);
        var startDay = first.getDay();
        var daysIn = new Date(viewYear, viewMonth + 1, 0).getDate();

        for (var e = 0; e < startDay; e++) {
            var empty = document.createElement('span');
            empty.className = 'bw-calendar__day bw-calendar__day--empty';
            calGrid.appendChild(empty);
        }

        for (var d = 1; d <= daysIn; d++) {
            var cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'bw-calendar__day';
            cell.textContent = d;
            var cellDate = new Date(viewYear, viewMonth, d);

            var isAvailable = cellDate >= today && cellDate <= maxDate &&
                AVAILABLE_DAYS.indexOf(cellDate.getDay()) !== -1;
            /* Also disable days where every slot is busy */
            if (isAvailable && isDayFullyBooked(cellDate)) isAvailable = false;
            if (!isAvailable) {
                cell.classList.add('bw-calendar__day--disabled');
                cell.disabled = true;
            } else {
                cell.setAttribute('data-date', viewYear + '-' + pad(viewMonth + 1) + '-' + pad(d));
            }

            if (selectedDate && cellDate.getTime() === selectedDate.getTime()) {
                cell.classList.add('bw-calendar__day--selected');
            }

            calGrid.appendChild(cell);
        }
    }

    function renderTimeSlots() {
        timesGrid.innerHTML = '';
        TIME_SLOTS.forEach(function (t) {
            var busy = selectedDate ? isSlotBusy(selectedDate, t) : false;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bw-times__slot';
            btn.textContent = formatTime12(t);
            btn.setAttribute('data-time', t);
            if (busy) {
                btn.classList.add('bw-times__slot--disabled');
                btn.disabled = true;
            }
            if (selectedTime === t && !busy) btn.classList.add('bw-times__slot--selected');
            timesGrid.appendChild(btn);
        });
    }

    /* ── MONTH NAVIGATION ── */
    prevBtn.addEventListener('click', function () {
        if (viewMonth === today.getMonth() && viewYear === today.getFullYear()) return;
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderCalendar();
    });

    nextBtn.addEventListener('click', function () {
        var maxM = maxDate.getMonth(), maxY = maxDate.getFullYear();
        if (viewYear > maxY || (viewYear === maxY && viewMonth >= maxM)) return;
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCalendar();
    });

    /* ── DAY CLICK ── */
    calGrid.addEventListener('click', function (e) {
        if (!contactData) return;
        var btn = e.target.closest('.bw-calendar__day[data-date]');
        if (!btn) return;
        var parts = btn.getAttribute('data-date').split('-');
        selectedDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        selectedTime = null;
        confirmBtn.style.display = 'none';
        renderCalendar();
        timesLabel.textContent = formatDate(selectedDate);
        renderTimeSlots();
        timesWrap.style.display = '';
    });

    /* ── TIME CLICK ── */
    timesGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('.bw-times__slot');
        if (!btn) return;
        selectedTime = btn.getAttribute('data-time');
        renderTimeSlots();
        confirmBtn.style.display = '';
    });

    /* ── STEP 1: CONTACT FORM ── */
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        contactData = {
            first_name: document.getElementById('bw-fname').value.trim(),
            last_name: document.getElementById('bw-lname').value.trim(),
            company_name: document.getElementById('bw-company').value.trim(),
            email: document.getElementById('bw-email').value.trim(),
            phone: document.getElementById('bw-phone').value.trim(),
            submitted_at: new Date().toISOString()
        };

        sendWebhook(WEBHOOK_CONTACT, contactData);

        blurOverlay.classList.add('bw-calendar__blur-overlay--hidden');
        step1.classList.add('bw-form-side--done');
        setProgress(2);
    });

    /* ── STEP 2: CONFIRM BOOKING ── */
    confirmBtn.addEventListener('click', function () {
        if (!selectedDate || !selectedTime || !contactData) return;
        var dateStr = selectedDate.getFullYear() + '-' + pad(selectedDate.getMonth() + 1) + '-' + pad(selectedDate.getDate());
        var payload = {
            first_name: contactData.first_name,
            last_name: contactData.last_name,
            company_name: contactData.company_name,
            email: contactData.email,
            phone: contactData.phone,
            date: dateStr,
            time: selectedTime,
            appointment_time: dateStr + ' ' + formatTime12(selectedTime),
            booked_at: new Date().toISOString()
        };

        sendWebhook(WEBHOOK_BOOKING, payload);

        step1.style.display = 'none';
        calendar.style.display = 'none';
        modal.querySelector('.bw-body').style.display = 'none';
        confirmedDetails.textContent = formatDate(selectedDate) + ' at ' + formatTime12(selectedTime);
        confirmedPanel.style.display = '';
    });

    /* ── OPEN / CLOSE ── */
    function resetWidget() {
        contactData = null;
        selectedDate = null;
        selectedTime = null;
        contactForm.reset();
        step1.classList.remove('bw-form-side--done');
        step1.style.display = '';
        calendar.style.display = '';
        modal.querySelector('.bw-body').style.display = '';
        blurOverlay.classList.remove('bw-calendar__blur-overlay--hidden');
        timesWrap.style.display = 'none';
        confirmBtn.style.display = 'none';
        confirmedPanel.style.display = 'none';
        setProgress(1);
        viewMonth = today.getMonth();
        viewYear = today.getFullYear();
        renderCalendar();
    }

    function openModal(e) {
        e.preventDefault();
        resetWidget();
        fetchBusyTimes(); /* Pull latest Google Calendar availability */
        modal.classList.add('modal--active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('modal--active');
        document.body.style.overflow = '';
    }

    document.querySelectorAll('.btn-popup').forEach(function (btn) {
        btn.addEventListener('click', openModal);
    });
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('modal--active')) closeModal();
    });

    renderCalendar();
})();
