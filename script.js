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
});

