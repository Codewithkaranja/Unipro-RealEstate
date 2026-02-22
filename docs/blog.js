  // Mobile menu toggle
        const mobileMenu = document.getElementById('mobileMenu');
        const navLinks = document.getElementById('navLinks');
        const overlay = document.getElementById('overlay');
        
        if (mobileMenu) {
            mobileMenu.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                overlay.classList.toggle('active');
                const icon = mobileMenu.querySelector('i');
                if (icon.classList.contains('fa-bars')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            });
        }
        
        // Category filtering
        const categoryFilters = document.querySelectorAll('.category-filter');
        const blogCards = document.querySelectorAll('.blog-card');
        
        categoryFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                // Remove active class from all filters
                categoryFilters.forEach(f => f.classList.remove('active'));
                // Add active class to clicked filter
                filter.classList.add('active');
                
                const category = filter.getAttribute('data-category');
                
                // Show/hide blog cards based on category
                blogCards.forEach(card => {
                    if (category === 'all' || card.getAttribute('data-category') === category) {
                        card.style.display = 'flex';
                        card.style.animation = 'fadeInUp 0.5s ease forwards';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
        
        // Blog search functionality
        const blogSearchForm = document.getElementById('blogSearchForm');
        if (blogSearchForm) {
            blogSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const searchInput = blogSearchForm.querySelector('input');
                const searchTerm = searchInput.value.toLowerCase().trim();
                
                if (searchTerm) {
                    // Filter cards based on search term
                    let foundResults = false;
                    
                    blogCards.forEach(card => {
                        const title = card.querySelector('h4').textContent.toLowerCase();
                        const excerpt = card.querySelector('p').textContent.toLowerCase();
                        const category = card.querySelector('.blog-card-category').textContent.toLowerCase();
                        
                        if (title.includes(searchTerm) || excerpt.includes(searchTerm) || category.includes(searchTerm)) {
                            card.style.display = 'flex';
                            card.style.animation = 'fadeInUp 0.5s ease forwards';
                            foundResults = true;
                        } else {
                            card.style.display = 'none';
                        }
                    });
                    
                    // Update category filters to show "All"
                    categoryFilters.forEach(f => {
                        if (f.getAttribute('data-category') === 'all') {
                            f.classList.add('active');
                        } else {
                            f.classList.remove('active');
                        }
                    });
                    
                    // Scroll to results
                    document.querySelector('.blog-grid-section').scrollIntoView({ behavior: 'smooth' });
                    
                    // Show message if no results
                    if (!foundResults) {
                        const gridContainer = document.getElementById('blogGrid');
                        const noResults = document.createElement('div');
                        noResults.innerHTML = `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: 16px;">
                                <h3 style="margin-bottom: 1rem; color: var(--dark-color);">No results found for "${searchTerm}"</h3>
                                <p style="color: var(--text-light); margin-bottom: 1.5rem;">Try searching with different keywords or browse our categories.</p>
                                <button id="resetSearch" class="btn btn-primary">Show All Articles</button>
                            </div>
                        `;
                        
                        // Remove previous no results message if exists
                        const existingNoResults = gridContainer.querySelector('.no-results');
                        if (existingNoResults) existingNoResults.remove();
                        
                        noResults.classList.add('no-results');
                        gridContainer.appendChild(noResults);
                        
                        // Add event listener to reset button
                        setTimeout(() => {
                            const resetButton = document.getElementById('resetSearch');
                            if (resetButton) {
                                resetButton.addEventListener('click', () => {
                                    blogCards.forEach(card => {
                                        card.style.display = 'flex';
                                        card.style.animation = 'fadeInUp 0.5s ease forwards';
                                    });
                                    noResults.remove();
                                    searchInput.value = '';
                                    categoryFilters.forEach(f => {
                                        if (f.getAttribute('data-category') === 'all') {
                                            f.classList.add('active');
                                        } else {
                                            f.classList.remove('active');
                                        }
                                    });
                                });
                            }
                        }, 100);
                    }
                }
            });
        }
        
        // Newsletter form submission
        const newsletterForm = document.getElementById('newsletterForm');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailInput = newsletterForm.querySelector('input[type="email"]');
                const email = emailInput.value.trim();
                
                if (email) {
                    // In a real implementation, you would send this to your backend
                    // For now, show a success message
                    const button = newsletterForm.querySelector('button');
                    const originalText = button.textContent;
                    
                    button.textContent = 'Subscribed!';
                    button.style.background = 'var(--success-color)';
                    button.disabled = true;
                    emailInput.value = '';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = 'var(--accent-color)';
                        button.disabled = false;
                    }, 3000);
                    
                    // You would typically send the email to your server here
                    console.log('Newsletter subscription:', email);
                }
            });
        }
        
        
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                if (href !== '#') {
                    e.preventDefault();
                    const targetElement = document.querySelector(href);
                    
                    if (targetElement) {
                        window.scrollTo({
                            top: targetElement.offsetTop - 100,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
        
        // Add click events to blog cards
        blogCards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', function(e) {
                // Don't trigger if clicking on a link inside the card
                if (!e.target.closest('a')) {
                    const link = this.querySelector('.read-more-link');
                    if (link) {
                        window.location.href = link.getAttribute('href');
                    }
                }
            });
        });