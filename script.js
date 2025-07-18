  // Dark mode toggle
  const toggleBtn = document.getElementById('dark-toggle');
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    if(document.body.classList.contains('dark')) {
      toggleBtn.textContent = 'Light Mode';
    } else {
      toggleBtn.textContent = 'Dark Mode';
    }
  });

  // Typing effect for hero section
  const typedText = document.getElementById('typed-text');
  const phrases = [
    'Learning web development.',
    'Building cool projects.',
    'Designing with creativity.',
    'Eager to grow and learn.'
  ];
  let phraseIndex = 0;
  let letterIndex = 0;
  let currentPhrase = '';
  let isDeleting = false;
  let speed = 100;

  function type() {
    if (phraseIndex >= phrases.length) phraseIndex = 0;
    currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      typedText.textContent = currentPhrase.substring(0, letterIndex + 1);
      letterIndex++;
      if (letterIndex === currentPhrase.length) {
        isDeleting = true;
        speed = 1500; // pause at full phrase
      } else {
        speed = 100;
      }
    } else {
      typedText.textContent = currentPhrase.substring(0, letterIndex - 1);
      letterIndex--;
      if (letterIndex === 0) {
        isDeleting = false;
        phraseIndex++;
        speed = 500;
      } else {
        speed = 50;
      }
    }
    setTimeout(type, speed);
  }
  document.addEventListener('DOMContentLoaded', () => {
    type();

    // Scroll fade-in effect
    const sections = document.querySelectorAll('section');
    const options = { threshold: 0.2 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, options);
    sections.forEach(section => observer.observe(section));
  });