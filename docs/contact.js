document.addEventListener('DOMContentLoaded', () => {
    // =========================
    // Mobile Menu Toggle
    // =========================
    const mobileMenuBtn = document.getElementById('mobileMenu');
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('overlay');

    if (mobileMenuBtn && navLinks && overlay) {
        const toggleMenu = () => {
            navLinks.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.classList.toggle('menu-open');

            mobileMenuBtn.innerHTML = navLinks.classList.contains('active')
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';
        };

        mobileMenuBtn.addEventListener('click', toggleMenu);

        document.querySelectorAll('#navLinks a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                overlay.classList.remove('active');
                document.body.classList.remove('menu-open');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });

        overlay.addEventListener('click', () => {
            navLinks.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('menu-open');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    }

    // =========================
    // Set current year in footer
    // =========================
    const yearElem = document.getElementById('currentYear');
    if (yearElem) yearElem.textContent = new Date().getFullYear();

    // =========================
    // Contact Form Submission
    // =========================
    const contactForm = document.getElementById('propertyInquiryForm');
    const successMessage = document.getElementById('successMessage');

    if (contactForm) {
        contactForm.addEventListener('submit', e => {
            e.preventDefault();

            const firstName = document.getElementById('firstName')?.value || '';
            const phone = document.getElementById('phone')?.value || '';
            const propertyType = document.getElementById('propertyType')?.value || '';
            const location = document.getElementById('location')?.value || '';
            const message = document.getElementById('message')?.value || '';

            let whatsappMessage = `Hello Unipro Real Estate,%0A%0A`;
            whatsappMessage += `I'm interested in property consultation.%0A`;
            whatsappMessage += `Name: ${firstName}%0A`;
            whatsappMessage += `Phone: ${phone}%0A`;
            if (propertyType) whatsappMessage += `Property Type: ${propertyType}%0A`;
            if (location) whatsappMessage += `Location: ${location}%0A`;
            whatsappMessage += `Message: ${message}%0A%0APlease contact me with available properties.`;

            window.open(`https://wa.me/254727619305?text=${whatsappMessage}`, '_blank');

            if (successMessage) successMessage.classList.add('show');
            contactForm.reset();

            if (successMessage) {
                setTimeout(() => successMessage.classList.remove('show'), 10000);
            }

            // Save email to localStorage
            const emailInput = document.getElementById('email');
            if (emailInput?.value) {
                localStorage.setItem('UniproRealEstateEmail', emailInput.value);
            }
        });

        // Auto-populate email if available from localStorage
        const savedEmail = localStorage.getItem('UniproRealEstateEmail');
        const emailInput = document.getElementById('email');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
        }
    }

    // =========================
    // Smooth Scrolling for Anchors
    // =========================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // =========================
    // Phone number formatting
    // =========================
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', e => {
            let value = e.target.value.replace(/\D/g, '');

            if (value.startsWith('0')) {
                value = '+254' + value.substring(1);
            } else if (value.startsWith('254')) {
                value = '+' + value;
            } else if (value.startsWith('7') && value.length === 9) {
                value = '+254' + value;
            }

            e.target.value = value;
        });
    }
});
