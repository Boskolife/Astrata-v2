// СИСТЕМА ДВОЙНЫХ СЕГМЕНТОВ:
// SEGMENTS - управляют появлением секций HTML (data-seg атрибуты)
// VIDEO_SEGMENTS - управляют воспроизведением видео (currentTime)

// Сегменты для управления появлением секций HTML
const SEGMENTS = [
  [4.6, 4.6], // Секция 0 (data-seg="0")
  [7.0, 7.0], // Секция 1 (data-seg="1")
  [15.3, 15.3], // Секция 2 (data-seg="2")
  [18.3, 18.3], // Секция 3 (data-seg="3")
  [22.25, 22.25], // Секция 4 (data-seg="4")
  [27.45, 27.45], // Секция 5 (data-seg="5")
  [29.4, 29.4], // Секция 6 (data-seg="6")
];

// Сегменты для управления воспроизведением видео (с промежуточными сегментами между каждой секцией кроме 5→6)
const VIDEO_SEGMENTS = [
  [0, 4.6], //  Интро
  [4.6, 4.6], // Видео сегмент 0: 4.6 - 4.6 сек (секция 0)
  [4.6, 7.0], // Промежуточный сегмент: 2.5 - 6.9 сек (переход 0→1)
  [7.0, 7.0], // Видео сегмент 1: 7.8 - 7.8 сек (секция 1)
  [7.0, 15.3], // Промежуточный сегмент: 6.9 - 14.85 сек (переход 1→2)
  [15.3, 15.3], // Видео сегмент 2: 15.3 - 15.3 сек (секция 2)
  [15.3, 18.3], // Промежуточный сегмент: 14.85 - 18.4 сек (переход 2→3)
  [18.3, 18.3], // Видео сегмент 3: 18.3 - 22.25 сек (секция 3)
  [18.3, 22.25], // Промежуточный сегмент: 18.4 - 22.1 сек (переход 3→4)
  [22.25, 22.25], // Видео сегмент 4: 22.25 - 22.25 сек (секция 4)
  [22.25, 27.45], // Промежуточный сегмент: 22.25 - 27.45 сек (переход 4→5)
  [27.45, 27.45], // Видео сегмент 5: 27.45 - 27.45 сек (секция 5)
  [27.45, 29.4], // Промежуточный сегмент: 27.45 - 29.4 сек (переход 5→6)
  [29.4, 29.4], // Видео сегмент 6: 29.4 - 29.4 сек (секция 6)
];

const LERP_ALPHA = 0.18; // быстрее сглаживание к целевому времени

const VELOCITY_BOOST = 0.06; // меньше влияние скорости на время видео

const SNAP_TO_FRAME = false; // без жесткой привязки к кадрам для плавности
const SOURCE_FPS = 60; // справочно, если SNAP_TO_FRAME включат

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

function setActive(element, isActive) {
  if (!element) return;
  if (isActive) {
    element.classList.add('active');
  } else {
    element.classList.remove('active');
  }
}

function setHudVisibility(isVisible) {
  try {
    const elements = [hud.seg, hud.prog, hud.time];
    elements.forEach((el) => setActive(el, isVisible));
  } catch (error) {
    console.warn('HUD visibility error:', error);
  }
}

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
let hasPlayedIntro = false; // Флаг: интро уже проиграно
let isPlayingIntro = false; // Флаг: сейчас проигрывается интро
let cancelIntroPlayback = null; // Функция отмены анимации интро

// Порог задержки при выходе из футера
let footerExitHoldDistance = 0; // Требуемая дистанция (px), обычно высота футера
let footerExitProgress = 0; // Накопленная дистанция (px) прокрутки вверх у верхней границы футера
let pinLastSectionOnce = false; // одноразовая фиксация последней секции после выхода из футера

// Переменные для управления блокировкой скролла и последовательным появлением
let isScrollLocked = false; // Флаг блокировки скролла
// Удалены неиспользуемые переменные для анимации секций

// Настройки виртуального скролла
const SCROLL_SENSITIVITY = 0.1; // ниже чувствительность скролла
const SCROLL_DAMPING = 0.28; // выше затухание для уменьшения дрожания
const TOTAL_SEGMENTS = SEGMENTS.length;
const MIN_SCROLL_THRESHOLD = 0.1; // Минимальный порог для начала скролла
const FOOTER_TRANSITION_HEIGHT = 10; // Высота перехода к футеру

// Настройки анимации блоков в секциях
const BLOCK_ANIMATION_DELAY = 10; // Задержка между появлением блоков (мс)
const SECTION_LOCK_DURATION = 1500; // Время блокировки скролла для секции (мс)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

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
  
  if (grayTexts.length === 0) return;
  
  let currentIndex = 0;
  
  const animateNextElement = () => {
    if (currentIndex >= grayTexts.length) return;
    
    const grayText = grayTexts[currentIndex];
    
    // Сбрасываем предыдущую анимацию если была
    resetTypingAnimation(grayText);
    
    // Запускаем анимацию для текущего элемента
    const charDelay = 30; // быстрее печать и меньшая пауза между элементами
    createTypingAnimation(grayText, charDelay);
    
    currentIndex++;
    
    // Переходим к следующему элементу после завершения текущего
    // Примерное время завершения анимации: количество символов * delay (без доп. буфера)
    const textLength = grayText.textContent.length;
    const estimatedDuration = Math.max(0, textLength * charDelay);
    
    setTimeout(animateNextElement, estimatedDuration);
  };
  
  // Запускаем анимацию с небольшой задержкой
  setTimeout(animateNextElement, 300);
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
  const seg = VIDEO_SEGMENTS[videoSegIndex];
  if (!seg) return false;
  const [a, b] = seg;
  // Переходный сегмент — когда start != end; пауза — когда start == end
  return a !== b;
}

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 50) {
  if (!element || element.classList.contains('typing-initialized')) {
    return;
  }

  const text = element.textContent;
  
  // Очищаем содержимое и добавляем класс для анимации
  element.innerHTML = '';
  element.classList.add('typing-animation', 'typing-initialized');

  // Разбиваем текст на слова
  const words = text.split(/(\s+)/); // Сохраняем пробелы как отдельные элементы
  
  // Создаем wrapper для каждого слова
  words.forEach((word, wordIndex) => {
    if (word.trim() === '') {
      // Если это пробелы, добавляем их как есть
      element.appendChild(document.createTextNode(word));
      return;
    }

    const wordWrapper = document.createElement('span');
    wordWrapper.className = 'word-wrapper';
    
    // Разбиваем слово на символы
    const chars = word.split('');
    chars.forEach((char) => {
      const charSpan = document.createElement('span');
      charSpan.className = 'char';
      charSpan.textContent = char;
      wordWrapper.appendChild(charSpan);
    });
    
    element.appendChild(wordWrapper);
  });

  // Анимируем слова последовательно
  const wordWrappers = element.querySelectorAll('.word-wrapper');
  let currentCharIndex = 0;
  
  const animateNextWord = () => {
    if (currentCharIndex >= wordWrappers.length) return;
    
    const wordWrapper = wordWrappers[currentCharIndex];
    const chars = wordWrapper.querySelectorAll('.char');
    
    // Анимируем символы в текущем слове
    chars.forEach((char, charIndex) => {
      setTimeout(() => {
        char.classList.add('active');
      }, charIndex * delay);
    });
    
    currentCharIndex++;
    
    // Переходим к следующему слову после завершения текущего
    setTimeout(animateNextWord, chars.length * delay + 100);
  };
  
  // Запускаем анимацию с небольшой задержкой
  setTimeout(animateNextWord, 200);
}

// Функция для сброса анимации печати
function resetTypingAnimation(element) {
  if (!element || !element.classList.contains('typing-initialized')) {
    return;
  }

  element.classList.remove('typing-animation', 'typing-initialized');
  
  // Восстанавливаем оригинальный текст
  const textNodes = Array.from(element.childNodes);
  let originalText = '';
  
  textNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      originalText += node.textContent;
    } else if (node.classList && node.classList.contains('word-wrapper')) {
      const chars = Array.from(node.querySelectorAll('.char'));
      originalText += chars.map(char => char.textContent).join('');
    }
  });
  
  element.innerHTML = originalText;
}

function detectActiveSection() {
  // Проверяем, находимся ли мы в режиме футера (с допуском, чтобы не требовать точного достижения конца)
  if (virtualScrollY >= maxVirtualScroll - FOOTER_TRANSITION_HEIGHT) {
    if (!isInFooterMode) {
      isInFooterMode = true;
      // Переключаемся в режим футера
      document.body.style.overflow = 'auto';
      // Устанавливаем задержку выхода = текущей высоте футера
      try {
        const footerEl = document.querySelector('footer');
        footerExitHoldDistance = (footerEl && footerEl.offsetHeight) || 0;
      } catch (_) {
        footerExitHoldDistance = 0;
      }
      footerExitProgress = 0;
      footerExitAt = 0;
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

  // Если не в переходе, привязываем секции к паузам видео сегментов
  // Паузы видео сегментов: videoSeg с start==end → секции идут в порядке
  const videoIndex = Math.floor(scrollProgress * VIDEO_SEGMENTS.length);
  const isTransition = isInTransitionSegment(videoIndex);
  if (!isTransition) {
    // Рассчитываем порядковый номер паузы среди всех пауз (пропуская переходы)
    let pauseCount = -1;
    for (let i = 0; i <= videoIndex; i++) {
      const [a, b] = VIDEO_SEGMENTS[i];
      if (a === b) pauseCount++;
    }
    // Картируем паузы к секциям (интро-пауза i=1 → секция 0 и т.д.)
    const mapped = Math.max(0, pauseCount - 0); // интро-пауза не секция
    activeSeg = clamp(mapped, 0, TOTAL_SEGMENTS - 1);
    return;
  }

  // Иначе — стандартная дискретизация по количеству секций
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

  // После первого проигрывания интро больше не возвращаемся в сегмент 0
  if (hasPlayedIntro && idx === 0) {
    idx = 1;
  }

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
    inTransition !== wasInTransition ||
    activeVideoSeg !== lastActiveVideoSeg
  ) {
    $sections.forEach((section, index) => {
      const segValue = parseInt(section.getAttribute('data-seg'));

      // Во время интро скрываем все секции и выходим
      if (activeVideoSeg === 0 && !isInFooterMode) {
        setActive(section, false);
        resetSectionBlocks(section);

        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      } else if (inTransition) {
        // В переходе скрываем все секции
        setActive(section, false);

        // Сбрасываем анимацию блоков для скрытых секций
        resetSectionBlocks(section);

        // Сбрасываем анимацию печати для неактивных секций
        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      } else if (segValue === activeSeg) {
        // Показываем активную секцию только если не в переходе
        setActive(section, true);

        // Запускаем анимацию блоков для новой секции (анимация печати запустится автоматически)
        animateSectionBlocks(section);
      } else {
        // Скрываем неактивные секции
        setActive(section, false);

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
        setActive(soundButtonWrap, false);
      } else if (activeVideoSeg === 0) {
        // Во время интро скрываем
        setActive(soundButtonWrap, false);
      } else if (activeSeg === TOTAL_SEGMENTS - 1) {
        // В последнем сегменте (но не в футере) скрываем только текст
        if (soundButtonText) {
          setActive(soundButtonText, false);
        }
        setActive(soundButtonWrap, true);
      } else {
        setActive(soundButtonText, true);
        setActive(soundButtonWrap, true);
      }
    }

    // Управляем видимостью arrow_down_wrap
    const arrowDownWrap = document.querySelector('.arrow_down_wrap');
    if (arrowDownWrap) {
      // В режиме футера или в последнем сегменте скрываем стрелку
      if (
        isInFooterMode ||
        activeSeg === TOTAL_SEGMENTS - 1 ||
        activeVideoSeg === 0
      ) {
        setActive(arrowDownWrap, false);
      } else {
        // В обычных секциях показываем стрелку
        setActive(arrowDownWrap, true);
      }
    }

    // Прячем/показываем header/footer в зависимости от интро
    const headerEl = document.querySelector('header');
    if (headerEl) setActive(headerEl, activeVideoSeg !== 0);
    const footerEl = document.querySelector('footer');
    // Показываем футер, когда включён режим футера или мы на последней секции вне перехода
    if (footerEl) {
      const shouldShowFooter = isInFooterMode === true || (!inTransition && activeSeg === TOTAL_SEGMENTS - 1);
      setActive(footerEl, shouldShowFooter);
    }

    lastActiveSeg = activeSeg;
    lastActiveVideoSeg = activeVideoSeg;
  }

  // Прячем HUD во время интро (VIDEO_SEGMENTS[0])
  if (activeVideoSeg === 0) {
    setHudVisibility(false);
  } else {
    setHudVisibility(true);
  }
}

// Одноразовое проигрывание интро на загрузке страницы
function startIntroPlayback() {
  if (hasPlayedIntro || isPlayingIntro) return;
  if (!Array.isArray(VIDEO_SEGMENTS) || VIDEO_SEGMENTS.length === 0) return;

  const [introStart, introEnd] = VIDEO_SEGMENTS[0];
  const introDurationMs = Math.max(
    200,
    Math.round((introEnd - introStart) * 1000),
  );
  const startTime = performance.now();
  isPlayingIntro = true;
  setHudVisibility(false);
  
  // Блокируем скролл во время интро
  lockScroll();

  let rafId = null;
  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / introDurationMs, 1);
    // Продвигаем виртуальный скролл внутри первой доли, соответствующей первому видео-сегменту
    const targetScrollProgress = progress / VIDEO_SEGMENTS.length;
    virtualScrollY = maxVirtualScroll * targetScrollProgress;
    updateSectionVisibility();

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      // По завершении фиксируемся сразу после интро
      finishIntroPlayback();
    }
  };

  cancelIntroPlayback = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    isPlayingIntro = false;
    setHudVisibility(true);
    // Разблокируем скролл при отмене интро
    unlockScroll();
  };

  rafId = requestAnimationFrame(step);
}

function finishIntroPlayback() {
  isPlayingIntro = false;
  hasPlayedIntro = true;
  // Устанавливаем позицию сразу после границы интро → следующего сегмента
  const afterIntroProgress = 1 / VIDEO_SEGMENTS.length + 0.0001;
  virtualScrollY = maxVirtualScroll * afterIntroProgress;
  setHudVisibility(true);
  // Разблокируем скролл после завершения интро
  unlockScroll();
  updateSectionVisibility();
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

    // Одноразовая фиксация на последней секции сразу после выхода из футера
    if (pinLastSectionOnce) {
      virtualScrollY = Math.max(0, maxVirtualScroll - 0.01);
      scrollVel = 0;
      pinLastSectionOnce = false;
    }

    // Без удержания: ничего не делаем специально, остаёмся на последней секции благодаря virtualScrollY = maxVirtualScroll

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
  // Если мы в режиме футера — добавляем задержку выхода (противоскролл) равную высоте футера
  if (isInFooterMode) {
    if (window.scrollY > 0) {
      // Пока не у верхней границы — стандартный скролл
      footerExitProgress = 0;
      return;
    }
    const delta = event.deltaY;
    if (delta < 0) {
      // Скролл вверх на верхней границе футера — накапливаем прогресс
      event.preventDefault();
      footerExitProgress += Math.abs(delta);
      if (footerExitProgress >= footerExitHoldDistance) {
        isInFooterMode = false;
        document.body.style.overflow = 'hidden';
        // Фиксируемся на последней секции, но избегаем точной границы
        virtualScrollY = Math.max(0, maxVirtualScroll - 0.01);
        footerExitProgress = 0;
        pinLastSectionOnce = true; // одноразово закрепим позицию в ближайшем кадре
        window.scrollTo(0, 0);
        updateSectionVisibility();
      }
    } else {
      // Скролл вниз — остаёмся в футере, сбрасываем прогресс
      footerExitProgress = 0;
    }
    return;
  }

  // Во время интро блокируем попытки скролла, не пропуская интро
  if (isPlayingIntro) {
    event.preventDefault();
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
    scrollVel = clamp(scrollVel, -28, 28);
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

  // Во время интро игнорируем попытки начать скролл
  if (isPlayingIntro) {
    return;
  }
}

function handleTouchMove(event) {
  // Если мы в режиме футера — добавляем задержку выхода (жест вверх) равную высоте футера
  if (isInFooterMode) {
    if (window.scrollY > 0) {
      // Пока не у верхней границы — стандартный скролл
      return;
    }

    const touchY = event.touches[0].clientY;
    const deltaY = lastTouchY - touchY; // < 0 — жест вверх (выход из футера)
    lastTouchY = touchY;

    if (deltaY < 0) {
      event.preventDefault();
      footerExitProgress += Math.abs(deltaY);
      if (footerExitProgress >= footerExitHoldDistance) {
        isInFooterMode = false;
        document.body.style.overflow = 'hidden';
        virtualScrollY = Math.max(0, maxVirtualScroll - 0.01);
        footerExitProgress = 0;
        pinLastSectionOnce = true;
        window.scrollTo(0, 0);
        updateSectionVisibility();
      }
    } else {
      // Жест вниз — остаёмся в футере, сбрасываем прогресс
      footerExitProgress = 0;
    }
    return;
  }

  // Во время интро блокируем скролл жестами
  if (isPlayingIntro) {
    event.preventDefault();
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
  scrollVel = clamp(scrollVel, -24, 24);
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
      // Выходим из футера: возвращаем обычную логику виртуального скролла
      isInFooterMode = false;
      document.body.style.overflow = 'hidden';
      // Возвращаемся к последнему моменту перед футером
      virtualScrollY = Math.max(0, maxVirtualScroll - window.innerHeight);
      // Фиксируем позицию и обновляем интерфейс
      window.scrollTo(0, 0);
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
    // При желании можно также запретить скип интро кнопкой — сейчас оставляем без скипа
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
      const iconOn = button.querySelector('.icon-on');
      const iconOff = button.querySelector('.icon-off');
      if (span) {
        span.textContent = isSoundOn ? 'Sound Off' : 'Sound On';
      }
      if (iconOn && iconOff) {
        iconOn.style.display = isSoundOn ? 'none' : 'block';
        iconOff.style.display = isSoundOn ? 'block' : 'none';
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

    // Запускаем одноразовое интро на старте
    startIntroPlayback();

    animationId = requestAnimationFrame(tick);
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
