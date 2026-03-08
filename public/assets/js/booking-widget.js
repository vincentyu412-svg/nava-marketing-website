/**
 * GymPropel — Booking Widget
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

    /* Available time slots in 24 h format — 1:00 AM to 11:00 PM (15-min intervals) */
    var TIME_SLOTS = [
        '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45',
        '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45',
        '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45',
        '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
        '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45',
        '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45',
        '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45',
        '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45',
        '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45',
        '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45',
        '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45',
        '23:00'
    ];

    var MAX_DAYS_AHEAD = 4;                 /* How far out visitors can book */
    var MIN_NOTICE_MS = 60 * 60 * 1000;   /* 1-hour minimum booking notice  */
    var AVAILABLE_DAYS = [0, 1, 2, 3, 4, 5, 6]; /* All days — Google Calendar controls actual availability */

    /* ── ELEMENTS ── */
    var modal = document.getElementById('popup-modal');
    var embedded = document.querySelector('.scale-booking');
    var container = modal || embedded;
    if (!container) return;
    var isEmbedded = !modal;
    var backdrop = modal ? modal.querySelector('.modal__backdrop') : null;
    var closeBtn = modal ? modal.querySelector('.modal__close') : null;
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
    var progressSteps = container.querySelectorAll('.bw-progress__step');
    var phoneInput = document.getElementById('bw-phone');

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
    var busyLoaded = false; /* Whether we have received Google Calendar data */

    /* ── HELPERS ── */
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    /* Auto-format phone number as (XXX) XXX-XXXX */
    function formatPhoneInput(value) {
        var digits = value.replace(/\D/g, '');
        /* Strip leading country code: +1 / 1 for US/CA */
        if (digits.length > 10 && digits.charAt(0) === '1') digits = digits.substring(1);
        digits = digits.substring(0, 10);
        if (digits.length === 0) return '';
        if (digits.length <= 3) return '(' + digits;
        if (digits.length <= 6) return '(' + digits.substring(0, 3) + ') ' + digits.substring(3);
        return '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    }

    phoneInput.addEventListener('input', function () {
        var cursor = phoneInput.selectionStart;
        var before = phoneInput.value;
        phoneInput.value = formatPhoneInput(before);
        /* Keep cursor reasonable after reformatting */
        var diff = phoneInput.value.length - before.length;
        phoneInput.setSelectionRange(cursor + diff, cursor + diff);
    });

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
        busyLoaded = false;
        /* Use fetch — Google Apps Script returns a 302 redirect that fetch handles reliably */
        fetch(GCAL_SCRIPT_URL, { redirect: 'follow' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                busyTimes = (data.busy || []).map(function (b) {
                    return { start: new Date(b.start), end: new Date(b.end) };
                }).filter(function (b) {
                    /* Ignore all-day / multi-day events (≥ 24 h) — they would
                       block entire days and are usually recurring calendar holds,
                       not real meetings. Actual time-specific events still filter. */
                    return (b.end.getTime() - b.start.getTime()) < 24 * 60 * 60 * 1000;
                });
                busyLoaded = true;
                renderCalendar();
                /* If a day was already selected, refresh its time slots */
                if (selectedDate) renderTimeSlots();
            })
            .catch(function (err) {
                console.warn('Booking widget: could not load calendar availability', err);
                busyTimes = [];
                busyLoaded = true;
                renderCalendar();
            });
    }

    /* Check if a specific date+time slot overlaps any busy period */
    function isSlotBusy(date, timeStr) {
        var parts = timeStr.split(':');
        var slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
            parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
        var slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000); /* 15-min slot */

        for (var i = 0; i < busyTimes.length; i++) {
            if (slotStart < busyTimes[i].end && slotEnd > busyTimes[i].start) {
                return true;
            }
        }
        return false;
    }

    /* Check if a slot is too soon (must be at least 1 hour from now) */
    function isSlotInPast(date, timeStr) {
        var now = new Date();
        var parts = timeStr.split(':');
        var slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
            parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
        return slotStart.getTime() <= now.getTime() + MIN_NOTICE_MS;
    }

    /* Deterministic hash — hides ~10 % of slots to create scarcity */
    function isSlotHidden(date, timeStr) {
        var seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
        var parts = timeStr.split(':');
        seed = seed * 31 + parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        return (seed % 10) === 0; /* ≈ 10 % of slots */
    }

    /* Check if a slot is unavailable (busy, too soon, OR hidden) */
    function isSlotUnavailable(date, timeStr) {
        return isSlotInPast(date, timeStr) || isSlotBusy(date, timeStr) || isSlotHidden(date, timeStr);
    }

    /* Check if an entire day has zero available slots */
    function isDayFullyBooked(date) {
        for (var i = 0; i < TIME_SLOTS.length; i++) {
            if (!isSlotUnavailable(date, TIME_SLOTS[i])) return false;
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
        var hasAvailable = false;
        TIME_SLOTS.forEach(function (t) {
            if (selectedDate && isSlotUnavailable(selectedDate, t)) return; /* Skip past & busy */
            hasAvailable = true;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bw-times__slot';
            btn.textContent = formatTime12(t);
            btn.setAttribute('data-time', t);
            if (selectedTime === t) btn.classList.add('bw-times__slot--selected');
            timesGrid.appendChild(btn);
        });
        /* If no slots are open, show a message */
        if (!hasAvailable) {
            var msg = document.createElement('p');
            msg.style.cssText = 'text-align:center;color:#888;padding:1rem 0;font-size:0.9rem;';
            msg.textContent = 'No available times on this day. Please pick another date.';
            timesGrid.appendChild(msg);
        }
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
        /* Update left-panel heading + date subtitle */
        var leftHeadingEl = document.getElementById('bw-times-left-heading');
        if (leftHeadingEl) {
            leftHeadingEl.innerHTML = 'Pick a <span class="bw-times-left__accent">Time</span>';
        }
        var leftDateEl = document.getElementById('bw-times-left-date');
        if (leftDateEl) {
            var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            leftDateEl.textContent = days[selectedDate.getDay()] + ', ' + MONTHS[selectedDate.getMonth()] + ' ' + selectedDate.getDate();
        }
        /* Hide summary card when times are shown */
        var summaryEl = document.getElementById('bw-summary');
        if (summaryEl) summaryEl.style.display = 'none';
        renderTimeSlots();
        timesWrap.style.display = '';
        /* Scroll time slots into view on mobile */
        timesWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            phone: '+1' + phoneInput.value.replace(/\D/g, ''),
            submitted_at: new Date().toISOString()
        };

        sendWebhook(WEBHOOK_CONTACT, contactData);

        blurOverlay.classList.add('bw-calendar__blur-overlay--hidden');
        step1.classList.add('bw-form-side--done');
        setProgress(2);

        /* Remove any existing left panel before creating a new one */
        var existingLeft = document.getElementById('bw-times-left');
        if (existingLeft) {
            calendar.appendChild(timesWrap);
            calendar.appendChild(confirmBtn);
            existingLeft.remove();
        }

        /* Build left-side panel with heading + summary + times area */
        var body = modal.querySelector('.bw-body');
        var timesLeft = document.createElement('div');
        timesLeft.className = 'bw-times-left';
        timesLeft.id = 'bw-times-left';

        /* "Pick a Date" heading (switches to "Pick a Time" after day click) */
        var leftHeading = document.createElement('h2');
        leftHeading.className = 'bw-times-left__heading';
        leftHeading.id = 'bw-times-left-heading';
        leftHeading.innerHTML = 'Pick a <span class="bw-times-left__accent">Date</span>';
        timesLeft.appendChild(leftHeading);

        /* Subtitle */
        var leftDate = document.createElement('p');
        leftDate.className = 'bw-times-left__date';
        leftDate.id = 'bw-times-left-date';
        leftDate.textContent = 'Select a day on the calendar to see available time slots.';
        timesLeft.appendChild(leftDate);

        /* Contact details summary card */
        var phoneFormatted = formatPhoneInput(phoneInput.value);
        var summaryCard = document.createElement('div');
        summaryCard.className = 'bw-summary';
        summaryCard.id = 'bw-summary';
        summaryCard.innerHTML =
            '<div class="bw-summary__row"><span class="bw-summary__label">Name</span><span class="bw-summary__value">' + contactData.first_name + ' ' + contactData.last_name + '</span></div>' +
            '<div class="bw-summary__row"><span class="bw-summary__label">Company</span><span class="bw-summary__value">' + contactData.company_name + '</span></div>' +
            '<div class="bw-summary__row"><span class="bw-summary__label">Email</span><span class="bw-summary__value">' + contactData.email + '</span></div>' +
            '<div class="bw-summary__row"><span class="bw-summary__label">Phone</span><span class="bw-summary__value">' + (phoneFormatted ? '+1 ' + phoneFormatted : contactData.phone) + '</span></div>';
        timesLeft.appendChild(summaryCard);

        /* Move the times wrapper and confirm button into the new left panel */
        timesLeft.appendChild(timesWrap);
        timesLeft.appendChild(confirmBtn);

        /* "← Edit Details" link */
        var editLink = document.createElement('button');
        editLink.type = 'button';
        editLink.className = 'bw-times-left__edit';
        editLink.innerHTML = '&larr; Edit Details';
        editLink.addEventListener('click', function () {
            /* Move times & confirm back into calendar side */
            calendar.appendChild(timesWrap);
            calendar.appendChild(confirmBtn);
            timesWrap.style.display = 'none';
            confirmBtn.style.display = 'none';
            selectedDate = null;
            selectedTime = null;
            var timesLeftEl = document.getElementById('bw-times-left');
            if (timesLeftEl) timesLeftEl.remove();
            /* Show form again and restore blur */
            step1.classList.remove('bw-form-side--done');
            blurOverlay.classList.remove('bw-calendar__blur-overlay--hidden');
            setProgress(1);
            renderCalendar();
        });
        timesLeft.appendChild(editLink);

        body.insertBefore(timesLeft, calendar);
    });

    /* ── STEP 2: CONFIRM BOOKING ── */
    confirmBtn.addEventListener('click', function () {
        if (!selectedDate || !selectedTime || !contactData) return;
        var dateStr = selectedDate.getFullYear() + '-' + pad(selectedDate.getMonth() + 1) + '-' + pad(selectedDate.getDate());
        var timeParts = selectedTime.split(':');
        var isoSlot = dateStr + 'T' + selectedTime + ':00';
        var payload = {
            first_name: contactData.first_name,
            last_name: contactData.last_name,
            company_name: contactData.company_name,
            email: contactData.email,
            phone: contactData.phone,
            date: dateStr,
            time: selectedTime,
            appointment_time: dateStr + ' ' + formatTime12(selectedTime),
            selected_slot: isoSlot,
            booked_at: new Date().toISOString()
        };

        sendWebhook(WEBHOOK_BOOKING, payload);

        /* Redirect to confirmation page with booking details */
        var redirectUrl = '/booking-confirmation.html?date=' + encodeURIComponent(dateStr) +
            '&time=' + encodeURIComponent(selectedTime) +
            '&fname=' + encodeURIComponent(contactData.first_name) +
            '&lname=' + encodeURIComponent(contactData.last_name);
        window.location.href = redirectUrl;
    });

    /* ── OPEN / CLOSE ── */
    function resetWidget() {
        contactData = null;
        selectedDate = null;
        selectedTime = null;
        busyTimes = [];
        busyLoaded = false;
        contactForm.reset();
        step1.classList.remove('bw-form-side--done');
        step1.style.display = '';
        calendar.style.display = '';
        modal.querySelector('.bw-body').style.display = '';
        blurOverlay.classList.remove('bw-calendar__blur-overlay--hidden');
        /* Move times & confirm back into calendar side if they were relocated */
        var timesLeftEl = document.getElementById('bw-times-left');
        if (timesLeftEl) {
            calendar.appendChild(timesWrap);
            calendar.appendChild(confirmBtn);
            timesLeftEl.remove();
        }
        timesWrap.style.display = 'none';
        confirmBtn.style.display = 'none';
        confirmedPanel.style.display = 'none';
        setProgress(1);
        viewMonth = today.getMonth();
        viewYear = today.getFullYear();
        renderCalendar();
    }

    function openModal(e) {
        if (isEmbedded) return;
        e.preventDefault();
        resetWidget();
        fetchBusyTimes(); /* Pull latest Google Calendar availability */
        modal.classList.add('modal--active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (isEmbedded) return;
        modal.classList.remove('modal--active');
        document.body.style.overflow = '';
    }

    if (!isEmbedded) {
        document.querySelectorAll('.btn-popup').forEach(function (btn) {
            btn.addEventListener('click', openModal);
        });
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('modal--active')) closeModal();
        });
    }

    renderCalendar();
    /* Auto-fetch availability for embedded mode */
    if (isEmbedded) {
        fetchBusyTimes();
    }
})();
