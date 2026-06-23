// Database setup for the "Your Appointment" application.
// We use IndexedDB to store doctor directories and patient bookings offline.

class YourAppointmentDB {
    constructor() {
        // Updated database name to flush old cache and remove doctor emojis
        this.dbName = 'YourAppointmentReceiptDB'; 
        this.dbVersion = 1;
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (e) => {
                console.error('Failed to open database:', e.target.error);
                reject(e.target.error);
            };

            request.onsuccess = async (e) => {
                this.db = e.target.result;
                
                // Populates doctor table if it is currently empty
                try {
                    const doctors = await this.getDoctors();
                    if (doctors.length === 0) {
                        await this.populateDefaultDoctors();
                    }
                } catch (err) {
                    console.error('Failed to check/populate doctors:', err);
                }
                
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Create Doctors Store
                if (!db.objectStoreNames.contains('doctors')) {
                    const docStore = db.createObjectStore('doctors', { keyPath: 'id' });
                    
                    // Populate initial doctors (without human-like emoji stickers)
                    const initialDoctors = [
                        {
                            id: 'doc-1',
                            name: 'Dr. Sarah Jimmy',
                            specialty: 'Pediatrics',
                            experience: '12 years',
                            rating: '4.9',
                            price: 100,
                            bio: 'Specialist in child wellness, checkups, and general pediatric medicine.',
                            slots: ['09:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:30 PM']
                        },
                        {
                            id: 'doc-2',
                            name: 'Dr. Vishnu Prasad',
                            specialty: 'Cardiology',
                            experience: '18 years',
                            rating: '4.8',
                            price: 100,
                            bio: 'Cardiologist focused on diagnostic care, heart health, and preventive consultations.',
                            slots: ['08:30 AM', '10:00 AM', '11:30 AM', '01:30 PM', '04:00 PM']
                        },
                        {
                            id: 'doc-3',
                            name: 'Dr. Sakria John',
                            specialty: 'Dermatology',
                            experience: '8 years',
                            rating: '4.7',
                            price: 100,
                            bio: 'Dermatology consultant handling skincare, allergy checks, and routine skin screenings.',
                            slots: ['09:30 AM', '11:30 AM', '02:30 PM', '03:00 PM', '04:30 PM']
                        },
                        {
                            id: 'doc-4',
                            name: 'Dr. Jimmy Joseph',
                            specialty: 'General Medicine',
                            experience: '15 years',
                            rating: '4.9',
                            price: 100,
                            bio: 'Family doctor offering routine physicals, wellness reviews, and health advice.',
                            slots: ['08:00 AM', '09:00 AM', '10:30 AM', '01:00 PM', '03:00 PM', '05:00 PM']
                        }
                    ];

                    initialDoctors.forEach(doc => docStore.put(doc));
                }
                
                // Create Appointments Store
                if (!db.objectStoreNames.contains('appointments')) {
                    db.createObjectStore('appointments', { keyPath: 'id' });
                }
            };
        });
    }

    // Populate initial doctors in database
    populateDefaultDoctors() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['doctors'], 'readwrite');
            const store = transaction.objectStore('doctors');
            
            const initialDoctors = [
                {
                    id: 'doc-1',
                    name: 'Dr. Sarah Jimmy',
                    specialty: 'Pediatrics',
                    experience: '12 years',
                    rating: '4.9',
                    price: 100,
                    bio: 'Specialist in child wellness, checkups, and general pediatric medicine.',
                    slots: ['09:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:30 PM']
                },
                {
                    id: 'doc-2',
                    name: 'Dr. Vishnu Prasad',
                    specialty: 'Cardiology',
                    experience: '18 years',
                    rating: '4.8',
                    price: 100,
                    bio: 'Cardiologist focused on diagnostic care, heart health, and preventive consultations.',
                    slots: ['08:30 AM', '10:00 AM', '11:30 AM', '01:30 PM', '04:00 PM']
                },
                {
                    id: 'doc-3',
                    name: 'Dr. Sakria John',
                    specialty: 'Dermatology',
                    experience: '8 years',
                    rating: '4.7',
                    price: 100,
                    bio: 'Dermatology consultant handling skincare, allergy checks, and routine skin screenings.',
                    slots: ['09:30 AM', '11:30 AM', '02:30 PM', '03:00 PM', '04:30 PM']
                },
                {
                    id: 'doc-4',
                    name: 'Dr. Jimmy Joseph',
                    specialty: 'General Medicine',
                    experience: '15 years',
                    rating: '4.9',
                    price: 100,
                    bio: 'Family doctor offering routine physicals, wellness reviews, and health advice.',
                    slots: ['08:00 AM', '09:00 AM', '10:30 AM', '01:00 PM', '03:00 PM', '05:00 PM']
                }
            ];

            initialDoctors.forEach(doc => store.put(doc));

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    // Get all doctors in our system
    async getDoctors() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['doctors'], 'readonly');
            const store = transaction.objectStore('doctors');
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Save appointment details
    async bookAppointment(appointment) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['appointments'], 'readwrite');
            const store = transaction.objectStore('appointments');
            const request = store.put(appointment);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Fetch all user bookings
    async getAppointments() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['appointments'], 'readonly');
            const store = transaction.objectStore('appointments');
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Remove a scheduled appointment
    async cancelAppointment(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['appointments'], 'readwrite');
            const store = transaction.objectStore('appointments');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Make it globally accessible
window.apptDb = new YourAppointmentDB();
