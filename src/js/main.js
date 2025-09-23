// СИСТЕМА ДВОЙНЫХ СЕГМЕНТОВ:
// SEGMENTS - управляют появлением секций HTML (data-seg атрибуты)
// VIDEO_SEGMENTS - управляют воспроизведением видео (currentTime)

// Сегменты для управления появлением секций HTML
const SEGMENTS = [
  [2.5, 2.5], // Секция 0 (data-seg="0")
  [6.9, 6.9], // Секция 1 (data-seg="1")
  [14.85, 14.85], // Секция 2 (data-seg="2")
  [18.4, 18.4], // Секция 3 (data-seg="3")
  [22.1, 22.1], // Секция 4 (data-seg="4")
  [26.34, 26.34], // Секция 5 (data-seg="5")
  [26.65, 26.65], // Секция 6 (data-seg="6")
];

// Сегменты для управления воспроизведением видео (с промежуточными сегментами между каждой секцией кроме 5→6)
const VIDEO_SEGMENTS = [
  [2.5, 2.5], // Видео сегмент 0: 2.5 - 2.5 сек (секция 0)
  [2.5, 6.9], // Промежуточный сегмент: 2.5 - 6.9 сек (переход 0→1)
  [6.9, 6.9], // Видео сегмент 1: 6.9 - 6.9 сек (секция 1)
  [6.9, 14.85], // Промежуточный сегмент: 6.9 - 14.85 сек (переход 1→2)
  [14.85, 14.85], // Видео сегмент 2: 14.85 - 14.85 сек (секция 2)
  [14.85, 18.4], // Промежуточный сегмент: 14.85 - 18.4 сек (переход 2→3)
  [18.4, 18.4], // Видео сегмент 3: 18.4 - 18.4 сек (секция 3)
  [18.4, 22.1], // Промежуточный сегмент: 18.4 - 22.1 сек (переход 3→4)
  [22.1, 22.1], // Видео сегмент 4: 22.1 - 22.1 сек (секция 4)
  [22.1, 26.34], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 4→5)
  [26.34, 26.34], // Видео сегмент 5: 26.34 - 26.34 сек (секция 5)
  [26.34, 26.65], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 5→6)
  [26.65, 26.65], // Видео сегмент 6: 26.34 - 26.34 сек (секция 6)
];

const LERP_ALPHA = 0.1;

const VELOCITY_BOOST = 0.12;

const SNAP_TO_FRAME = true;
const SOURCE_FPS = 120;

function primeVideoPlayback(video) {
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  const unlock = () => {
    try {
      video.muted = true;
      const p = video.play();
      if (p && p.then) {
        p.then(() => video.pause()).catch((error) => {
          console.warn('Video play error:', error);
        });
      } else {
        video.play();
        video.pause();
      }
    } catch (error) {
      console.warn('Video playback error:', error);
    }
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('click', unlock);
  };

  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}

const $video = document.getElementById('video');
const $sections = Array.from(document.querySelectorAll('.section'));
const hud = {
  seg: document.getElementById('hud-seg'),
  prog: document.getElementById('hud-prog'),
  time: document.getElementById('hud-time'),
};

// Виртуальный скролл
let virtualScrollY = 0;
let maxVirtualScroll = 0;
let scrollVel = 0;
let smoothedTime = 0;
let activeSeg = 0;
let lastActiveSeg = -1;
let activeVideoSeg = 0; // Активный видео сегмент
let lastActiveVideoSeg = -1; // Предыдущий активный видео сегмент
let isPageVisible = true;
let animationId = null;
let isInFooterMode = false; // Флаг для режима футера

// Переменные для управления блокировкой скролла и последовательным появлением
let isScrollLocked = false; // Флаг блокировки скролла
let sectionAnimationTimeout = null; // Таймер для анимации секции
let currentSectionBlocks = []; // Массив блоков текущей секции
let currentBlockIndex = 0; // Индекс текущего блока

// Настройки виртуального скролла
const SCROLL_SENSITIVITY = 0.1; // Чувствительность скролла
const SCROLL_DAMPING = 0.2; // Затухание скорости
const TOTAL_SEGMENTS = SEGMENTS.length;
const MIN_SCROLL_THRESHOLD = 0.1; // Минимальный порог для начала скролла
const FOOTER_TRANSITION_HEIGHT = 10; // Высота перехода к футеру

// Настройки анимации блоков в секциях
const BLOCK_ANIMATION_DELAY = 10; // Задержка между появлением блоков (мс)
const SECTION_LOCK_DURATION = 1500; // Время блокировки скролла для секции (мс)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, v) => (v - a) / (b - a);

// Функция для блокировки скролла
function lockScroll() {
  isScrollLocked = true;
}

// Функция для разблокировки скролла
function unlockScroll() {
  isScrollLocked = false;
}

// Функция для последовательного появления блоков в секции
function animateSectionBlocks(section) {
  if (!section) return;

  // Находим все блоки текста в секции
  const textBlocks = section.querySelectorAll('p, .form_wrap');

  if (textBlocks.length === 0) return;

  // Скрываем все блоки изначально
  textBlocks.forEach((block) => {
    block.style.opacity = '0';
    block.style.transform = 'translateY(20px)';
    block.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  // Скролл не блокируем во время анимации

  // Показываем блоки последовательно
  let blockIndex = 0;
  const showNextBlock = () => {
    if (blockIndex < textBlocks.length) {
      const block = textBlocks[blockIndex];
      block.style.opacity = '1';
      block.style.transform = 'translateY(0)';
      blockIndex++;

      if (blockIndex < textBlocks.length) {
        setTimeout(showNextBlock, BLOCK_ANIMATION_DELAY);
      } else {
        // После показа всех блоков запускаем анимацию печати для серого текста
        setTimeout(() => {
          startTypingAnimation(section);
        }, 300); // Небольшая задержка после появления всех блоков
        
        // Скролл не блокируем, поэтому разблокировка не требуется
      }
    }
  };

  // Запускаем анимацию с небольшой задержкой
  setTimeout(showNextBlock, 200);
}

// Функция для запуска анимации печати после появления всех блоков
function startTypingAnimation(section) {
  const grayTexts = section.querySelectorAll('.gray_text');
  grayTexts.forEach((grayText) => {
    // Сбрасываем предыдущую анимацию если была
    resetTypingAnimation(grayText);
    // Запускаем новую анимацию
    createTypingAnimation(grayText, 50);
  });
}

// Функция для сброса анимации блоков секции
function resetSectionBlocks(section) {
  if (!section) return;

  const textBlocks = section.querySelectorAll('p, .form_wrap');
  textBlocks.forEach((block) => {
    block.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    block.style.opacity = '0';
    block.style.transform = 'translateY(20px)';
  });
}

// Функция для определения, находимся ли мы в переходном сегменте
function isInTransitionSegment(videoSegIndex) {
  // Индексы переходных сегментов в массиве VIDEO_SEGMENTS
  // Переходы: 0→1, 1→2, 2→3, 3→4, 4→5 (НЕТ перехода 5→6)
  const transitionSegments = [1, 3, 5, 7, 9, 11]; // Индексы переходов между секциями
  return transitionSegments.includes(videoSegIndex);
}

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 100) {
  if (!element || element.classList.contains('typing-initialized')) {
    return;
  }

  const text = element.textContent;
  const chars = text.split('');

  // Очищаем содержимое и добавляем класс для анимации
  element.innerHTML = '';
  element.classList.add('typing-animation', 'typing-initialized');

  // Создаем span для каждой буквы
  chars.forEach((char, index) => {
    const charSpan = document.createElement('span');
    charSpan.className = 'char';
    charSpan.textContent = char; // Оставляем обычные пробелы для адаптивности
    element.appendChild(charSpan);
  });

  // Запускаем анимацию
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((charEl, index) => {
    setTimeout(() => {
      charEl.classList.add('active');
    }, index * delay);
  });
}

// Функция для сброса анимации печати
function resetTypingAnimation(element) {
  if (!element || !element.classList.contains('typing-initialized')) {
    return;
  }

  element.classList.remove('typing-animation', 'typing-initialized');
  const chars = Array.from(element.querySelectorAll('.char')).map(
    (char) => char.textContent,
  );
  element.innerHTML = chars.join('');
}

function detectActiveSection() {
  // Проверяем, находимся ли мы в режиме футера
  if (virtualScrollY >= maxVirtualScroll) {
    if (!isInFooterMode) {
      isInFooterMode = true;
      // Переключаемся в режим футера
      document.body.style.overflow = 'auto';
    }
    activeSeg = TOTAL_SEGMENTS - 1; // Показываем последнюю секцию
    return;
  }

  if (isInFooterMode) {
    isInFooterMode = false;
    // Возвращаемся к режиму видео
    document.body.style.overflow = 'hidden';
  }

  // Определяем активный сегмент на основе виртуального скролла
  const scrollProgress = Math.max(
    0,
    Math.min(1, virtualScrollY / maxVirtualScroll),
  );

  // Определяем активный сегмент на основе прогресса виртуального скролла
  let idx = Math.floor(scrollProgress * TOTAL_SEGMENTS);

  // Ограничиваем индекс диапазоном сегментов
  idx = Math.max(0, Math.min(idx, TOTAL_SEGMENTS - 1));

  activeSeg = idx;
}

// Функция для определения активного видео сегмента
function detectActiveVideoSegment() {
  // Если мы в режиме футера, не обновляем видео сегмент
  if (isInFooterMode) {
    return;
  }

  // Определяем активный видео сегмент на основе виртуального скролла
  const scrollProgress = Math.max(
    0,
    Math.min(1, virtualScrollY / maxVirtualScroll),
  );

  // Определяем активный видео сегмент на основе прогресса виртуального скролла
  // Используем общее количество видео сегментов для плавного воспроизведения
  let idx = Math.floor(scrollProgress * VIDEO_SEGMENTS.length);

  // Ограничиваем индекс диапазоном видео сегментов
  idx = Math.max(0, Math.min(idx, VIDEO_SEGMENTS.length - 1));

  activeVideoSeg = idx;
}

function updateSectionVisibility() {
  // Проверяем режим футера перед обновлением видимости
  const wasInFooterMode = isInFooterMode;

  // Сначала проверяем, нужно ли переключиться в режим футера
  detectActiveSection();
  detectActiveVideoSegment();

  // Проверяем, находимся ли мы в переходном сегменте
  const inTransition = isInTransitionSegment(activeVideoSeg);

  // Обновляем видимость если активный сегмент изменился, режим футера изменился, или изменился статус перехода
  const wasInTransition = isInTransitionSegment(lastActiveVideoSeg || 0);
  if (
    activeSeg !== lastActiveSeg ||
    wasInFooterMode !== isInFooterMode ||
    inTransition !== wasInTransition
  ) {
    $sections.forEach((section, index) => {
      const segValue = parseInt(section.getAttribute('data-seg'));

      // Скрываем секции если мы в переходе, независимо от того, какая секция должна быть активной
      if (inTransition) {
        // В переходе скрываем все секции
        section.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.classList.remove('active');

        // Сбрасываем анимацию блоков для скрытых секций
        resetSectionBlocks(section);

        // Сбрасываем анимацию печати для неактивных секций
        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      } else if (segValue === activeSeg) {
        // Показываем активную секцию только если не в переходе
        section.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
        section.style.opacity = '1';
        section.style.visibility = 'visible';
        section.classList.add('active');

        // Запускаем анимацию блоков для новой секции (анимация печати запустится автоматически)
        animateSectionBlocks(section);
      } else {
        // Скрываем неактивные секции
        section.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.classList.remove('active');

        // Сбрасываем анимацию блоков для скрытых секций
        resetSectionBlocks(section);

        // Сбрасываем анимацию печати для неактивных секций
        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      }
    });

    // Управляем видимостью sound_button_wrap
    const soundButtonWrap = document.querySelector('.sound_button_wrap');
    if (soundButtonWrap) {
      const soundButtonText = soundButtonWrap.querySelector('p');

      // Приоритет: сначала проверяем режим футера
      if (isInFooterMode) {
        // В режиме футера скрываем весь элемент
        soundButtonWrap.style.transition =
          'opacity 0.5s ease, visibility 0.5s ease';
        soundButtonWrap.style.opacity = '0';
        soundButtonWrap.style.visibility = 'hidden';
      } else if (activeSeg === TOTAL_SEGMENTS - 1) {
        // В последнем сегменте (но не в футере) скрываем только текст
        if (soundButtonText) {
          soundButtonText.style.transition =
            'opacity 0.5s ease, visibility 0.5s ease';
          soundButtonText.style.opacity = '0';
          soundButtonText.style.visibility = 'hidden';
        }
        soundButtonWrap.style.transition =
          'opacity 0.5s ease, visibility 0.5s ease';
        soundButtonWrap.style.opacity = '1';
        soundButtonWrap.style.visibility = 'visible';
      } 
    }

    // Управляем видимостью arrow_down_wrap
    const arrowDownWrap = document.querySelector('.arrow_down_wrap');
    if (arrowDownWrap) {
      // В режиме футера или в последнем сегменте скрываем стрелку
      if (isInFooterMode || activeSeg === TOTAL_SEGMENTS - 1) {
        arrowDownWrap.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
        arrowDownWrap.style.opacity = '0';
        arrowDownWrap.style.visibility = 'hidden';
      } else {
        // В обычных секциях показываем стрелку
        arrowDownWrap.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
        arrowDownWrap.style.opacity = '1';
        arrowDownWrap.style.visibility = 'visible';
      }
    }

    lastActiveSeg = activeSeg;
    lastActiveVideoSeg = activeVideoSeg;
  }
}

function tick() {
  // Пропускаем анимацию если страница не видна
  if (!isPageVisible) {
    animationId = requestAnimationFrame(tick);
    return;
  }

  try {
    // Применяем затухание к скорости скролла
    scrollVel *= 1 - SCROLL_DAMPING;

    // Обновляем виртуальную позицию скролла
    virtualScrollY += scrollVel;

    // Если мы в режиме футера, разрешаем скролл дальше
    if (isInFooterMode) {
      // В режиме футера не ограничиваем скролл
      virtualScrollY = Math.max(virtualScrollY, maxVirtualScroll);
    } else {
      // В обычном режиме ограничиваем скролл
      virtualScrollY = clamp(virtualScrollY, 0, maxVirtualScroll);
    }

    detectActiveSection();
    detectActiveVideoSegment();
    updateSectionVisibility();

    // В режиме футера не управляем скроллом программно
    if (!isInFooterMode) {
      window.scrollTo(0, 0);
    }

    // Вычисляем время видео только если не в режиме футера
    if (!isInFooterMode) {
      const scrollProgress = Math.max(
        0,
        Math.min(1, virtualScrollY / maxVirtualScroll),
      );

      // Определяем локальный прогресс внутри текущего видео сегмента
      const videoSegmentProgress = (scrollProgress * VIDEO_SEGMENTS.length) % 1;

      const [t0, t1] = VIDEO_SEGMENTS[activeVideoSeg];
      let targetTime = lerp(t0, t1, videoSegmentProgress);

      if (VELOCITY_BOOST !== 0) {
        const segLen = Math.abs(t1 - t0) || 0.001;
        const dir = Math.sign(scrollVel);
        targetTime +=
          dir *
          Math.min(Math.abs(scrollVel) / 1000, 1) *
          segLen *
          VELOCITY_BOOST;
        targetTime = clamp(targetTime, Math.min(t0, t1), Math.max(t0, t1));
      }

      smoothedTime = lerp(smoothedTime || t0, targetTime, LERP_ALPHA);

      if (SNAP_TO_FRAME && SOURCE_FPS > 0) {
        const step = 1 / SOURCE_FPS;
        smoothedTime = Math.round(smoothedTime / step) * step;
      }

      if ($video && $video.readyState >= 2) {
        if (!$video.seeking) {
          $video.currentTime = smoothedTime;
        }
      }

      if (hud.seg) hud.seg.textContent = String(activeSeg);
      if (hud.prog) hud.prog.textContent = videoSegmentProgress.toFixed(2);
      if (hud.time) hud.time.textContent = smoothedTime.toFixed(2);
    }
  } catch (error) {
    console.warn('Animation tick error:', error);
  }

  animationId = requestAnimationFrame(tick);
}

function loadVideo() {
  if ($video && $video.readyState < 2) {
    $video.load();
  }
}

// Обработчики виртуального скролла
function handleWheel(event) {
  // Если мы в режиме футера, разрешаем стандартный скролл
  if (isInFooterMode) {
    return;
  }

  // Если скролл заблокирован, предотвращаем событие
  if (isScrollLocked) {
    event.preventDefault();
    return;
  }

  event.preventDefault();

  // Получаем дельту скролла
  const delta = event.deltaY;

  // Применяем чувствительность только если дельта больше порога
  if (Math.abs(delta) > MIN_SCROLL_THRESHOLD) {
    scrollVel += delta * SCROLL_SENSITIVITY;

    // Ограничиваем максимальную скорость
    scrollVel = clamp(scrollVel, -40, 40);
  }
}

// Тач-события для мобильных устройств
let touchStartY = 0;
let touchStartTime = 0;
let lastTouchY = 0;
let touchVelocity = 0;
let touchTotalDelta = 0;

function handleTouchStart(event) {
  touchStartY = event.touches[0].clientY;
  lastTouchY = touchStartY;
  touchStartTime = Date.now();
  touchVelocity = 0;
  touchTotalDelta = 0;
}

function handleTouchMove(event) {
  // Если мы в режиме футера, разрешаем стандартный скролл
  if (isInFooterMode) {
    return;
  }

  // Если скролл заблокирован, предотвращаем событие
  if (isScrollLocked) {
    event.preventDefault();
    return;
  }

  event.preventDefault();

  const touchY = event.touches[0].clientY;
  const deltaY = lastTouchY - touchY;
  const currentTime = Date.now();
  const timeDelta = currentTime - touchStartTime;

  // Вычисляем скорость тача
  if (timeDelta > 0) {
    touchVelocity = deltaY / timeDelta;
  }

  // Применяем чувствительность к тач-событиям
  scrollVel += deltaY * SCROLL_SENSITIVITY * 0.3;
  // Копим общий сдвиг для учета длины свайпа
  touchTotalDelta += deltaY;

  lastTouchY = touchY;
}

function handleTouchEnd(event) {
  // Добавляем инерцию на основе скорости свайпа
  const touchEndTime = Date.now();
  const touchDuration = touchEndTime - touchStartTime;

  if (touchDuration < 200 && Math.abs(touchVelocity) > 0.5) {
    // Быстрый свайп - добавляем инерцию
    scrollVel += touchVelocity * 100;
  }

  // Добавляем вклад, зависящий от общей длины свайпа
  // Чем длиннее свайп, тем больше смещение виртуального скролла
  const distanceBoost = touchTotalDelta * SCROLL_SENSITIVITY * 1;
  scrollVel += distanceBoost;

  // Ограничиваем максимальную скорость
  scrollVel = clamp(scrollVel, -30, 30);
}

$video.addEventListener('loadedmetadata', () => {
  const dur = $video.duration || 0;

  // Ограничиваем сегменты для секций
  for (let i = 0; i < SEGMENTS.length; i++) {
    SEGMENTS[i][0] = clamp(SEGMENTS[i][0], 0, dur);
    SEGMENTS[i][1] = clamp(SEGMENTS[i][1], 0, dur);
  }

  // Ограничиваем видео сегменты
  for (let i = 0; i < VIDEO_SEGMENTS.length; i++) {
    VIDEO_SEGMENTS[i][0] = clamp(VIDEO_SEGMENTS[i][0], 0, dur);
    VIDEO_SEGMENTS[i][1] = clamp(VIDEO_SEGMENTS[i][1], 0, dur);
  }

  smoothedTime = VIDEO_SEGMENTS[0][0] || 0;

  // Устанавливаем максимальный виртуальный скролл
  maxVirtualScroll = window.innerHeight * TOTAL_SEGMENTS;
});

// Добавляем обработчики событий для виртуального скролла
document.addEventListener('wheel', handleWheel, { passive: false });
document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: true });

// Обработчик для переключения обратно к видео при скролле вверх в футере
document.addEventListener(
  'scroll',
  () => {
    if (isInFooterMode && window.scrollY <= 0) {
      isInFooterMode = false;
      virtualScrollY = maxVirtualScroll - 1;
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);

      // Обновляем видимость элементов интерфейса
      updateSectionVisibility();
    }
  },
  { passive: true },
);

// Функция для скролла к секции с формой
function scrollToForm() {
  // Находим секцию с формой (data-seg="6" - последняя секция)
  const formSection = document.querySelector('[data-seg="6"]');
  if (formSection) {
    // Создаем плавную анимацию скролла к форме
    // Устанавливаем цель чуть раньше конца, чтобы можно было скроллить дальше
    const targetScroll = maxVirtualScroll - window.innerHeight * 0.5;
    const startScroll = virtualScrollY;
    const duration = 1000; // 1 секунда анимации
    const startTime = performance.now();

    function animateScroll(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Используем easeInOutCubic для плавной анимации
      const easeInOutCubic =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      virtualScrollY =
        startScroll + (targetScroll - startScroll) * easeInOutCubic;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        // Финальная позиция - не в самом конце, чтобы можно было скроллить дальше
        virtualScrollY = targetScroll;
        activeSeg = 6; // Последний сегмент (индекс 6 для 7 сегментов 0-6)
      }

      // Обновляем видимость секций во время анимации
      updateSectionVisibility();
    }

    requestAnimationFrame(animateScroll);
  }
}

// Обработчик клика на кнопку в хедере
function handleHeaderButtonClick(event) {
  const target = event.target.closest('a[href="#form"]');
  if (target) {
    event.preventDefault();
    scrollToForm();
  }
}

// Обработчики для загрузки видео
document.addEventListener('click', loadVideo, { once: true });
document.addEventListener('touchstart', loadVideo, {
  once: true,
  passive: true,
});

// Добавляем обработчик для кнопки в хедере
document.addEventListener('click', handleHeaderButtonClick);

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
});

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Удаляем обработчики событий
  document.removeEventListener('wheel', handleWheel);
  document.removeEventListener('touchstart', handleTouchStart);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);
  document.removeEventListener('click', handleHeaderButtonClick);
}

window.addEventListener('beforeunload', cleanup);

function initSoundButtons() {
  const soundButtons = document.querySelectorAll('.toggle-sound');
  let isSoundOn = false;

  soundButtons.forEach((button) => {
    button.addEventListener('click', () => {
      isSoundOn = !isSoundOn;
      const span = button.querySelector('span');
      if (span) {
        span.textContent = isSoundOn ? 'Sound Off' : 'Sound On';
      }

      if ($video) {
        $video.muted = !isSoundOn;
      }
    });
  });
}

window.addEventListener('load', () => {
  try {
    primeVideoPlayback($video);
    initSoundButtons();

    // Инициализируем виртуальный скролл
    maxVirtualScroll = window.innerHeight * TOTAL_SEGMENTS;
    virtualScrollY = 0;
    activeSeg = 0;
    activeVideoSeg = 0;
    isScrollLocked = false; // Инициализируем состояние блокировки скролла

    updateSectionVisibility();

    animationId = requestAnimationFrame(tick);
  } catch (error) {
    console.error('Initialization error:', error);
  }
});