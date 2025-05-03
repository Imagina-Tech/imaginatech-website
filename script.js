document.addEventListener("DOMContentLoaded", function() {
    const servicesToggle = document.getElementById("services-toggle");
    const servicesContent = document.getElementById("services-content");

    if (servicesToggle && servicesContent) {
        servicesToggle.addEventListener("click", function() {
            if (servicesContent.style.display === "none" || servicesContent.style.display === "") {
                servicesContent.style.display = "block";
            } else {
                servicesContent.style.display = "none";
            }
        });
    }

    // Tracking eventos
    const whatsappButton = document.querySelector('.whatsapp');
    if (whatsappButton) {
        whatsappButton.addEventListener('click', function() {
            // Envia evento para Google Analytics/Google Ads
            gtag('event', 'whatsapp_click', {
                'event_category': 'engagement',
                'event_label': 'whatsapp_contact',
                'transport_type': 'beacon'
            });
        });
    }
});
