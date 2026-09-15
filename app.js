/**
 * Portfolio of Dmitry Kamenskikh — Interactive Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Ambient Starlight Canvas
  const canvas = document.getElementById('ambient-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const stars = Array.from({ length: 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.2 + 0.05,
      twinkleSpeed: Math.random() * 0.015 + 0.005,
    }));

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const animateCanvas = () => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        star.y -= star.speed;
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }
        star.alpha += Math.sin(Date.now() * star.twinkleSpeed) * 0.01;
        star.alpha = Math.max(0.15, Math.min(0.9, star.alpha));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(animateCanvas);
    };
    requestAnimationFrame(animateCanvas);
  }

  // 2. Header Scroll & Active Section Indicator
  const header = document.querySelector('.site-header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section.section');

  const onScroll = () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

    let currentSectionId = 'hero';
    sections.forEach((sec) => {
      const top = sec.offsetTop - 140;
      const height = sec.offsetHeight;
      if (window.scrollY >= top && window.scrollY < top + height) {
        currentSectionId = sec.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      if (link.getAttribute('data-nav') === currentSectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3. Hero Browser Carousel
  const slides = [
    {
      title: 'Ваш бизнес<br>в цифровом мире',
      desc: 'Современные сайты для роста<br>и новых возможностей',
      btn: 'Начать проект',
      page: '01 / 03',
    },
    {
      title: 'Интерфейсы<br>нового уровня',
      desc: 'Продуманный UX, высокая скорость<br>и максимальная конверсия',
      btn: 'Смотреть кейсы',
      page: '02 / 03',
    },
    {
      title: 'Технологии<br>для лидеров',
      desc: 'От архитектуры и дизайна<br>до безупречного запуска',
      btn: 'Обсудить сайт',
      page: '03 / 03',
    },
  ];

  let currentSlide = 0;
  const slideTitle = document.getElementById('browser-slide-title');
  const slideDesc = document.getElementById('browser-slide-desc');
  const slideBtn = document.getElementById('browser-slide-btn');
  const slidePagination = document.getElementById('browser-pagination');
  const prevBtn = document.querySelector('.prev-slide');
  const nextBtn = document.querySelector('.next-slide');

  const renderSlide = (idx) => {
    currentSlide = (idx + slides.length) % slides.length;
    const s = slides[currentSlide];
    if (slideTitle) slideTitle.innerHTML = s.title;
    if (slideDesc) slideDesc.innerHTML = s.desc;
    if (slideBtn) {
      slideBtn.innerHTML = `<span>${s.btn}</span><span class="btn-arrow">→</span>`;
    }
    if (slidePagination) slidePagination.textContent = s.page;
  };

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderSlide(currentSlide - 1);
    });
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderSlide(currentSlide + 1);
    });
  }

  // 4. Section 02 VS Code Mini Editor Tabs
  const codeSnippets = {
    html: {
      lines: ['1', '2', '3', '4', '', '5', '6'],
      code: `<span class="c-tag">&lt;section</span> <span class="c-attr">class</span>=<span class="c-str">"hero"</span><span class="c-tag">&gt;</span>
  <span class="c-tag">&lt;h1&gt;</span>Идеи превращаются
  в реальность<span class="c-tag">&lt;/h1&gt;</span>
  <span class="c-tag">&lt;p&gt;</span>Современные решения
  для вашего бизнеса<span class="c-tag">&lt;/p&gt;</span>
  <span class="c-tag">&lt;button</span> <span class="c-attr">class</span>=<span class="c-str">"btn"</span><span class="c-tag">&gt;</span>Начать<span class="c-tag">&lt;/button&gt;</span>
<span class="c-tag">&lt;/section&gt;</span>`,
    },
    css: {
      lines: ['1', '2', '3', '4', '5', '6', '7'],
      code: `<span class="c-tag">.hero</span> {
  <span class="c-attr">display</span>: flex;
  <span class="c-attr">background</span>: <span class="c-str">rgba(14,17,23,.9)</span>;
  <span class="c-attr">border-radius</span>: <span class="c-str">12px</span>;
  <span class="c-attr">backdrop-filter</span>: <span class="c-str">blur(18px)</span>;
  <span class="c-attr">color</span>: <span class="c-str">#ffffff</span>;
}`,
    },
    js: {
      lines: ['1', '2', '3', '4', '5', '6'],
      code: `<span class="c-tag">const</span> button = <span class="c-light">document</span>.<span class="c-attr">querySelector</span>(<span class="c-str">'.btn'</span>);

button.<span class="c-attr">addEventListener</span>(<span class="c-str">'click'</span>, () => {
  <span class="c-attr">launchProject</span>({ mode: <span class="c-str">'premium'</span> });
});`,
    },
  };

  const ideTabs = document.querySelectorAll('.ide-tab');
  const codeBlock = document.getElementById('ide-code-block');
  const lineNumbers = document.querySelector('.code-line-numbers');

  ideTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      ideTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const fileKey = tab.getAttribute('data-file');
      const snippet = codeSnippets[fileKey] || codeSnippets.html;
      if (codeBlock) codeBlock.innerHTML = snippet.code;
      if (lineNumbers) {
        lineNumbers.innerHTML = snippet.lines.map((l) => `<span>${l}</span>`).join('');
      }
    });
  });

  // 5. Section 03 Before / After Split Comparison Slider
  const stage = document.getElementById('comparison-stage');
  const beforeLayer = document.getElementById('comparison-before-layer');
  const divider = document.getElementById('comparison-divider');
  let isDragging = false;

  const updateSplit = (clientX) => {
    if (!stage || !beforeLayer || !divider) return;
    const rect = stage.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    if (offsetX < 10) offsetX = 10;
    if (offsetX > rect.width - 10) offsetX = rect.width - 10;
    const percentage = (offsetX / rect.width) * 100;
    beforeLayer.style.width = `${percentage}%`;
    divider.style.left = `${percentage}%`;
  };

  if (stage) {
    stage.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateSplit(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateSplit(e.clientX);
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        updateSplit(e.touches[0].clientX);
      }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length === 0) return;
      updateSplit(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  // 6. Contact Modal
  const modal = document.getElementById('contact-modal');
  const openModalBtn = document.getElementById('open-contact-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const successCloseBtn = document.getElementById('success-close-btn');
  const contactForm = document.getElementById('contact-form');
  const successState = document.getElementById('modal-success-state');

  const openModal = () => {
    if (!modal) return;
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
      closeModal();
      if (contactForm) contactForm.reset();
      if (successState) successState.style.display = 'none';
      if (contactForm) contactForm.style.display = 'block';
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-active')) {
      closeModal();
    }
  });

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      contactForm.style.display = 'none';
      if (successState) successState.style.display = 'block';
    });
  }

});
