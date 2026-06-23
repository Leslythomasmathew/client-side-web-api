// Main application controller for the Your Appointment booking portal.
// This handles form queries, speech inputs, Geolocation, and booking receipt modals.

document.addEventListener('DOMContentLoaded', async () => {
    // Current application state
    const state = {
        theme: 'light', // Default is now light theme
        doctors: [],
        selectedSpecialty: 'General Medicine',
        selectedDoctorId: null,
        selectedSlot: null,
        coords: null,
        notificationPermission: 'default',
        lastBookedAppt: null // Holds receipt reference for downloads
    };

    // Grab all DOM nodes
    const elements = {
        themeToggle: document.getElementById('theme-toggle'),
        themeIcon: document.getElementById('theme-icon'),
        notiToggleBtn: document.getElementById('noti-toggle-btn'),
        notiIcon: document.getElementById('noti-icon'),
        
        specialtySelector: document.getElementById('specialty-selector'),
        doctorList: document.getElementById('doctor-list'),
        bookingDate: document.getElementById('booking-date'),
        slotsList: document.getElementById('slots-list'),
        bookingPatientId: document.getElementById('booking-patient-id'),
        bookingPriceTag: document.getElementById('booking-price-tag'),
        symptomNotes: document.getElementById('symptom-notes'),
        dictateBtn: document.getElementById('dictate-btn'),
        bookBtn: document.getElementById('book-btn'),
        
        geoLocateBtn: document.getElementById('geo-locate-btn'),
        geoStatusCard: document.getElementById('geo-status-card'),
        
        // Confirmation modal elements
        receiptModal: document.getElementById('receipt-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        receiptSummary: document.getElementById('receipt-summary'),
        downloadReceiptBtn: document.getElementById('download-receipt-btn'),
        closeReceiptBtn: document.getElementById('close-receipt-btn')
    };

    // Set default booking date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    elements.bookingDate.value = tomorrow.toISOString().split('T')[0];
    elements.bookingDate.min = tomorrow.toISOString().split('T')[0];
    elements.bookingPatientId.value = '';

    // Connect to database and load settings
    try {
        await window.apptDb.init();
        loadSettings();
        
        // Fetch values
        state.doctors = await window.apptDb.getDoctors();
        renderDoctors();
        
        // Fetch third-party daily health tip
        fetchDailyHealthTip();
    } catch (e) {
        console.error('Error starting database systems:', e);
    }

    // Queries third-party Advice Slip API for a daily motivation slip
    async function fetchDailyHealthTip() {
        try {
            const res = await fetch('https://api.adviceslip.com/advice');
            const data = await res.json();
            if (data && data.slip) {
                document.getElementById('health-tip-text').textContent = `Today's Wellness Tip: "${data.slip.advice}"`;
            }
        } catch (e) {
            document.getElementById('health-tip-text').textContent = "Today's Wellness Tip: Drink plenty of water and stay active!";
        }
    }

    // Load user settings from LocalStorage
    function loadSettings() {
        const storedTheme = localStorage.getItem('ya-theme') || 'light';
        state.theme = storedTheme;
        document.documentElement.setAttribute('data-theme', storedTheme);
        updateThemeIcon();
    }

    // Swaps the sun/moon icon on the theme button
    function updateThemeIcon() {
        if (state.theme === 'light') {
            elements.themeIcon.setAttribute('data-lucide', 'moon');
        } else {
            elements.themeIcon.setAttribute('data-lucide', 'sun');
        }
        lucide.createIcons();
    }

    // Theme toggle button click handler
    elements.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        updateThemeIcon();
        localStorage.setItem('ya-theme', state.theme);
    });

    // Check notification permissions and update toggle UI icon
    function syncNotificationStatus() {
        if (!("Notification" in window)) {
            elements.notiToggleBtn.style.display = 'none';
            return;
        }

        state.notificationPermission = Notification.permission;
        if (state.notificationPermission === 'granted') {
            elements.notiIcon.setAttribute('data-lucide', 'bell');
            elements.notiToggleBtn.classList.add('active');
        } else {
            elements.notiIcon.setAttribute('data-lucide', 'bell-off');
            elements.notiToggleBtn.classList.remove('active');
        }
        lucide.createIcons();
    }

    // Prompt user for notification access
    elements.notiToggleBtn.addEventListener('click', async () => {
        if (!("Notification" in window)) return;

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            state.notificationPermission = permission;
            syncNotificationStatus();
        } else if (Notification.permission === 'granted') {
            alert('Notifications are already active. You can adjust them in browser site settings.');
        } else {
            alert('Notifications are currently blocked. Please reset site permissions in the browser address bar.');
        }
    });

    // Fire standard system notification
    function fireNotification(title, body) {
        if (state.notificationPermission === 'granted') {
            new Notification(title, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/822/822143.png'
            });
        }
    }
    
    syncNotificationStatus();

    // Geolocation pharmacy locator
    elements.geoLocateBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Your browser does not support geolocation details.');
            return;
        }

        elements.geoLocateBtn.querySelector('span').textContent = 'Locating...';
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                state.coords = { lat, lon };
                
                elements.geoStatusCard.innerHTML = `
                    <a href="https://www.google.com/maps/search/pharmacy+near+${lat},${lon}" target="_blank" class="geo-btn-text">
                        <i data-lucide="external-link"></i>
                        <span>Open Pharmacies Map</span>
                    </a>
                `;
                lucide.createIcons();
            },
            (err) => {
                console.error('Location error:', err);
                alert('Could not retrieve location. Check browser permission prompt.');
                elements.geoLocateBtn.querySelector('span').textContent = 'Find Pharmacies';
            }
        );
    });

    // Render list of doctors filtered by chosen specialty
    function renderDoctors() {
        elements.doctorList.innerHTML = '';
        state.selectedDoctorId = null;
        state.selectedSlot = null;
        elements.slotsList.innerHTML = '<span class="placeholder-text">Please choose a doctor...</span>';

        const filtered = state.doctors.filter(d => d.specialty === state.selectedSpecialty);

        if (filtered.length === 0) {
            elements.doctorList.innerHTML = '<p class="placeholder-text">No doctors available in this section.</p>';
            return;
        }

        filtered.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doctor-item-card';
            card.innerHTML = `
                <div class="doc-meta">
                    <span class="doc-name">${doc.name}</span>
                    <span class="doc-specialty">${doc.specialty}</span>
                    <p class="doc-bio">${doc.bio}</p>
                    <div class="doc-sub">
                        <span>Fee: ₹${doc.price}</span>
                        <span>⭐ ${doc.rating}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.doctor-item-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.selectedDoctorId = doc.id;
                renderSlots(doc.slots);
            });

            elements.doctorList.appendChild(card);
        });
    }

    // Render time slot selection chips
    function renderSlots(slots) {
        elements.slotsList.innerHTML = '';
        state.selectedSlot = null;

        if (!slots || slots.length === 0) {
            elements.slotsList.innerHTML = '<span class="placeholder-text">No timings available.</span>';
            return;
        }

        slots.forEach(slot => {
            const chip = document.createElement('button');
            chip.className = 'slot-chip';
            chip.textContent = slot;

            chip.addEventListener('click', () => {
                document.querySelectorAll('.slot-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                state.selectedSlot = slot;
            });

            elements.slotsList.appendChild(chip);
        });
    }

    // Handles changes to specialty selections
    elements.specialtySelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.specialty-chip');
        if (!btn) return;

        document.querySelectorAll('.specialty-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        state.selectedSpecialty = btn.getAttribute('data-specialty');
        renderDoctors();
    });

    // Voice dictation of symptom description (Speech-to-Text)
    function initSpeechRecognition() {
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionClass) {
            elements.dictateBtn.style.display = 'none';
            return;
        }

        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        elements.dictateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (elements.dictateBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                elements.dictateBtn.classList.add('recording');
                elements.dictateBtn.querySelector('span').textContent = 'Listening...';
                recognition.start();
            }
        });

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            
            if (elements.symptomNotes.value) {
                elements.symptomNotes.value += ' ' + text;
            } else {
                elements.symptomNotes.value = text;
            }
        };

        recognition.onend = () => {
            elements.dictateBtn.classList.remove('recording');
            elements.dictateBtn.querySelector('span').textContent = 'Dictate';
        };

        recognition.onerror = () => {
            elements.dictateBtn.classList.remove('recording');
            elements.dictateBtn.querySelector('span').textContent = 'Dictate';
        };
    }
    
    initSpeechRecognition();

    // Confirm booking event handler
    elements.bookBtn.addEventListener('click', async () => {
        const patientId = elements.bookingPatientId.value.trim();
        if (!patientId) {
            alert('Please enter your Patient ID to schedule a booking.');
            return;
        }

        // Validate that Patient ID is numeric-only (digits only, e.g. 2400000)
        const isDigits = /^\d+$/.test(patientId);
        if (!isDigits) {
            alert('Please enter a valid Patient ID using numbers only (e.g. 2400000).');
            return;
        }

        if (!state.selectedDoctorId) {
            alert('Please select a doctor.');
            return;
        }
        if (!state.selectedSlot) {
            alert('Please choose an available time slot.');
            return;
        }
        
        const doctor = state.doctors.find(d => d.id === state.selectedDoctorId);
        const dateVal = elements.bookingDate.value;
        const symptoms = elements.symptomNotes.value.trim() || 'Routine review';

        if (!dateVal) {
            alert('Please select a valid calendar date.');
            return;
        }

        const appointment = {
            id: 'appt-' + Date.now(),
            doctorId: doctor.id,
            doctorName: doctor.name,
            doctorSpecialty: doctor.specialty,
            date: dateVal,
            time: state.selectedSlot,
            notes: symptoms,
            patientId: patientId,
            price: 100, // Flat price consultation of 100
            status: 'Scheduled'
        };

        try {
            await window.apptDb.bookAppointment(appointment);
            

            // Send system prompt alert
            fireNotification(
                'Visit Booked Successfully', 
                `Your appointment with ${doctor.name} (₹100) is scheduled on ${dateVal} at ${state.selectedSlot}.`
            );

            // Save reference to state
            state.lastBookedAppt = appointment;

            // Render modal receipt card details
            displayReceiptModal(appointment);

            // Clean inputs
            elements.symptomNotes.value = '';
            elements.bookingPatientId.value = ''; // Reset patient ID box for the next booking
            document.querySelectorAll('.doctor-item-card').forEach(c => c.classList.remove('selected'));
            document.querySelectorAll('.slot-chip').forEach(c => c.classList.remove('selected'));
            state.selectedDoctorId = null;
            state.selectedSlot = null;

        } catch (e) {
            console.error('Database write error:', e);
            alert('Failed to log appointment details.');
        }
    });

    // Populate receipt template elements and show modal
    function displayReceiptModal(appt) {
        elements.receiptSummary.innerHTML = `
            <div class="receipt-row">
                <span class="receipt-label">Receipt ID</span>
                <span class="receipt-value">${appt.id}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Patient ID</span>
                <span class="receipt-value">${appt.patientId}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Doctor</span>
                <span class="receipt-value">${appt.doctorName}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Department</span>
                <span class="receipt-value">${appt.doctorSpecialty}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Date & Time</span>
                <span class="receipt-value">${appt.date} at ${appt.time}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Consultation Fee</span>
                <span class="receipt-value">₹${appt.price}.00</span>
            </div>
        `;

        elements.receiptModal.classList.remove('hidden');
    }

    // Modal Action listeners (Download Receipt & Close)
    elements.downloadReceiptBtn.addEventListener('click', () => {
        if (!state.lastBookedAppt) return;
        triggerReceiptDownload(state.lastBookedAppt);
    });

    function triggerReceiptDownload(appt) {
        const { jsPDF } = window.jspdf;
        // Create a compact A6 receipt document
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a6'
        });

        // 1. Draw a neat header branding bar
        doc.setFillColor(249, 115, 22); // Sunset Orange
        doc.rect(0, 0, 105, 16, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("YOUR APPOINTMENT", 52.5, 7, { align: 'center' });
        doc.setFontSize(8);
        doc.text("OFFICIAL BOOKING RECEIPT", 52.5, 12, { align: 'center' });

        // 2. Draw content rows
        doc.setTextColor(30, 41, 59);
        doc.setFont("Helvetica", "normal");
        
        doc.setFontSize(8);
        doc.setFont("Helvetica", "bold");
        doc.text("Booking Reference:", 10, 26);
        doc.setFont("Helvetica", "normal");
        doc.text(appt.id, 42, 26);

        doc.setFont("Helvetica", "bold");
        doc.text("Patient Reference ID:", 10, 33);
        doc.setFont("Helvetica", "normal");
        doc.text(appt.patientId, 42, 33);

        doc.setFont("Helvetica", "bold");
        doc.text("Practitioner:", 10, 40);
        doc.setFont("Helvetica", "normal");
        doc.text(appt.doctorName, 42, 40);

        doc.setFont("Helvetica", "bold");
        doc.text("Department:", 10, 47);
        doc.setFont("Helvetica", "normal");
        doc.text(appt.doctorSpecialty, 42, 47);

        doc.setFont("Helvetica", "bold");
        doc.text("Date & Time:", 10, 54);
        doc.setFont("Helvetica", "normal");
        doc.text(`${appt.date} at ${appt.time}`, 42, 54);

        doc.setFont("Helvetica", "bold");
        doc.text("Consultation Fee:", 10, 61);
        doc.setFont("Helvetica", "normal");
        doc.text(`INR 100.00`, 42, 61);

        doc.setFont("Helvetica", "bold");
        doc.text("Symptoms/Notes:", 10, 68);
        doc.setFont("Helvetica", "normal");
        // Handle multiline symptom notes nicely
        const splitNotes = doc.splitTextToSize(appt.notes || 'Routine checkup', 50);
        doc.text(splitNotes, 42, 68);

        // 3. Draw a separator line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(10, 88, 95, 88);

        // 4. Footer greetings
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("This receipt is a dynamically generated view-only record.", 52.5, 93, { align: 'center' });
        doc.text("Thank you for scheduling with Your Appointment!", 52.5, 96, { align: 'center' });

        // Save PDF file to disk
        doc.save(`Receipt-${appt.patientId}-${appt.date}.pdf`);
    }

    function closeModal() {
        elements.receiptModal.classList.add('hidden');
        state.lastBookedAppt = null;
    }

    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.closeReceiptBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === elements.receiptModal) {
            closeModal();
        }
    });
});
