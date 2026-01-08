document.addEventListener('DOMContentLoaded', () => {
    const navPills = document.querySelector('.nav-pills');
    const activeLink = document.querySelector('.nav-pills .nav-link.active');

    if (navPills && activeLink) {
        const glider = document.createElement('span');
        glider.classList.add('glider');
        navPills.prepend(glider);

        // Set initial glider position
        glider.style.width = `${activeLink.offsetWidth}px`;
        glider.style.left = `${activeLink.offsetLeft}px`;
    }
});