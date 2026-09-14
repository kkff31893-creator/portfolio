const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = document.querySelectorAll('.reveal');

if (reduceMotion) {
  reveals.forEach((element) => element.classList.remove('is-pending'));
} else {
  reveals.forEach((element) => element.classList.add('is-pending'));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-pending');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -7%' },
  );
  reveals.forEach((element) => observer.observe(element));

}
