/**
 * Gym Grow — Booking Widget
 * Two-step calendar: contact form → pick a day & time.
 * Sends webhooks to GoHighLevel on each step.
 */
(function () {
    'use strict';

    /* ── CONFIG ── */
    var WEBHOOK_CONTACT = ''; /* GoHighLevel webhook URL — fires when visitor submits contact details */
    var WEBHOOK_BOOKING = ''; /* GoHighLevel webhook URL — fires when visitor confirms a booking      */

    /* Available time slots in 24 h format */
    var TIME_SLOTS = [
        '09:00','09:30','10:00','10:30','11:00','11:30',
        '12:00','12:30','13:00','13:30','14:00','14:30',
        '15:00','15:30','16:00','16:30','17:00'
    ];

    var MAX_DAYS_AHEAD  = 60;                /* How far out visitors can book */
    var AVAILABLE_DAYS  = [1, 2, 3, 4, 5];   /* Mon – Fri (0 = Sun, 6 = Sat) */

    /* ── ELEMENTS ── */
    var modal          = document.getElementById('popup-modal');
    if (!modal) return;
    var backdrop       = modal.querySelector('.modal__backdrop');
    var closeBtn       = modal.querySelector('.modal__close');
    var step1          = document.getElementById('bw-step-1');
    var calendar       = document.getElementById('bw-calendar');
    var blurOverlay    = document.getElementById('bw-blur-overlay');
    var contactForm    = document.getElementById('bw-contact-form');
    var calGrid        = document.getElementById('bw-cal-grid');
    var monthLabel     = document.getElementById('bw-month-label');
    var prevBtn        = document.getElementById('bw-prev-month');
    var nextBtn        = document.getElementById('bw-next-month');
    var timesWrap      = document.getElementById('bw-times');
    var timesGrid      = document.getElementById('bw-times-grid');
    var timesLabel     = document.getElementById('bw-times-label');
    var confirmBtn     = document.getElementById('bw-confirm');
    var confirmedPanel = document.getElementById('bw-confirmed');
    var confirmedDetails = document.getElementById('bw-confirmed-details');
    var progressSteps  = modal.querySelectorAll('.bw-progress__step');

    var MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var today  = new Date(); today.setHours(0,0,0,0);
    var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);
    var viewMonth = today.getMonth();
    var viewYear  = today.getFullYear();

    var contactData  = null;
    var selectedDate = null;
    var selectedTime = null;

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

    /* ── CALENDAR RENDER ── */
    function renderCalendar() {
        calGrid.innerHTML = '';
        monthLabel.textContent = MONTHS[viewMonth] + ' ' + viewYear;
        var first    = new Date(viewYear, viewMonth, 1);
        var startDay = first.getDay();
        var daysIn   = new Date(viewYear, viewMonth + 1, 0).getDate();

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
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bw-times__slot';
            btn.textContent = formatTime12(t);
            btn.setAttribute('data-time', t);
            if (selectedTime === t) btn.classList.add('bw-times__slot--selected');
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
            first_name:   document.getElementById('bw-fname').value.trim(),
            last_name:    document.getElementById('bw-lname').value.trim(),
            email:        document.getElementById('bw-email').value.trim(),
            phone:        document.getElementById('bw-phone').value.trim(),
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
        var payload = {
            first_name: contactData.first_name,
            last_name:  contactData.last_name,
            email:      contactData.email,
            phone:      contactData.phone,
            date:       selectedDate.getFullYear() + '-' + pad(selectedDate.getMonth() + 1) + '-' + pad(selectedDate.getDate()),
            time:       selectedTime,
            booked_at:  new Date().toISOString()
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
        contactData  = null;
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
        viewYear  = today.getFullYear();
        renderCalendar();
    }

    function openModal(e) {
        e.preventDefault();
        resetWidget();
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
