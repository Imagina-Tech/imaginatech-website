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
            
            // Envia evento para Meta Pixel
            fbq('track', 'Contact');  // Evento padrão para contato
            
            // ou você pode usar um evento customizado:
            // fbq('trackCustom', 'WhatsAppClick', {
            //     button_type: 'contact',
            //     service: 'whatsapp'
            // });
        });
    }
});
