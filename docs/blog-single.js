  // Set current year
        document.getElementById('year').textContent = new Date().getFullYear();
        
        // Mobile menu toggle
        const mobileMenu = document.querySelector('.mobile-menu');
        const navLinks = document.querySelector('.nav-links');
        
        if (mobileMenu) {
            mobileMenu.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                const icon = mobileMenu.querySelector('i');
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            });
        }
        
        // Newsletter form submission
        const newsletterForm = document.getElementById('singleNewsletterForm');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = newsletterForm.querySelector('input[type="email"]').value;
                const button = newsletterForm.querySelector('button');
                
                // Show success state
                button.innerHTML = '<i class="fas fa-check"></i> Subscribed!';
                button.style.background = '#00a86b';
                button.disabled = true;
                
                // Reset after 3 seconds
                setTimeout(() => {
                    button.innerHTML = 'Subscribe Now';
                    button.style.background = 'var(--premium-gold)';
                    button.disabled = false;
                    newsletterForm.reset();
                }, 3000);
                
                // In production, send to backend
                console.log('Newsletter subscription:', email);
            });
        }
        
        // Smooth scroll for table of contents
        document.querySelectorAll('.toc-list a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        // Print functionality
        const printButton = document.createElement('button');
        printButton.innerHTML = '<i class="fas fa-print"></i> Print Guide';
        printButton.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 30px;
            background: var(--premium-gold);
            color: var(--deep-navy);
            border: none;
            padding: 12px 20px;
            border-radius: 50px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(212, 175, 55, 0.3);
            z-index: 999;
            transition: all 0.3s ease;
            font-family: 'Jost', sans-serif;
        `;
        
        printButton.addEventListener('mouseenter', () => {
            printButton.style.transform = 'translateY(-3px)';
            printButton.style.boxShadow = '0 12px 32px rgba(212, 175, 55, 0.4)';
        });
        
        printButton.addEventListener('mouseleave', () => {
            printButton.style.transform = 'translateY(0)';
            printButton.style.boxShadow = '0 8px 24px rgba(212, 175, 55, 0.3)';
        });
        
        printButton.addEventListener('click', () => {
            window.print();
        });
        
        document.body.appendChild(printButton);
        
        // Add reading progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: var(--premium-gold);
            width: 0%;
            z-index: 1001;
            transition: width 0.3s ease;
        `;
        
        document.body.appendChild(progressBar);
        
        window.addEventListener('scroll', () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            progressBar.style.width = scrolled + '%';
        });
        
        // Share functionality
        const shareButton = document.createElement('button');
        shareButton.innerHTML = '<i class="fas fa-share-alt"></i> Share';
        shareButton.style.cssText = `
            position: fixed;
            bottom: 180px;
            right: 30px;
            background: var(--deep-navy);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 50px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(10, 26, 45, 0.3);
            z-index: 999;
            transition: all 0.3s ease;
            font-family: 'Jost', sans-serif;
        `;
        
        shareButton.addEventListener('mouseenter', () => {
            shareButton.style.transform = 'translateY(-3px)';
            shareButton.style.boxShadow = '0 12px 32px rgba(10, 26, 45, 0.4)';
        });
        
        shareButton.addEventListener('mouseleave', () => {
            shareButton.style.transform = 'translateY(0)';
            shareButton.style.boxShadow = '0 8px 24px rgba(10, 26, 45, 0.3)';
        });
        
        shareButton.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: document.title,
                    text: document.querySelector('meta[name="description"]').getAttribute('content'),
                    url: window.location.href
                });
            } else {
                // Fallback: Copy to clipboard
                navigator.clipboard.writeText(window.location.href);
                shareButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    shareButton.innerHTML = '<i class="fas fa-share-alt"></i> Share';
                }, 2000);
            }
        });
        
        document.body.appendChild(shareButton);