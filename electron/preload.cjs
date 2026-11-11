// Arayüze masaüstü uygulamasında çalıştığını bildirir (başlık çubuğu yerleşimi için)
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop', `platform-${process.platform}`);
});
