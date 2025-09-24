import { SEGMENTS } from './timecode';

/**
 * Простая система скролл-видео с показом секций по таймкодам
 */

// DOM элементы
const $video = document.getElementById('video');
const $sections = Array.from(document.querySelectorAll('.section'));
const $soundButton = document.querySelector('.toggle-sound');
const $soundButtonWrap = document.querySelector('.sound_button_wrap');

// Переменные состояния
let currentSection = 0; // текущая активная секция
let isScrollBlocked = false; // флаг блокировки скролла
let lastSectionCheck = 0; // время последней проверки секций
let isShowingSection = false; // флаг показа секции (предотвращает скрытие во время паузы)
let scrollPosition = 0; // позиция скролла во время блокировки
let videoTimeAtBlock = 0; // время видео в момент блокировки
let isSoundOn = true; // состояние звука (по умолчанию включен)

// Настройки
const LERP_ALPHA = 0.15; // плавность перехода видео (увеличено для более плавного скролла)
const VELOCITY_BOOST = 0; // ускорение от скорости скролла (отключено)
const PAUSE_DURATION = 3000; // длительность паузы секции (1.5 секунды)
const SECTION_CHECK_INTERVAL = 100; // проверяем секции каждые 100мс вместо каждого кадра

/**
 * Получает прогресс скролла от 0 до 1
 */
function getScrollProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
}

/**
 * Создает анимацию печатания для элемента
 */
function createTypingAnimation(element, delay = 100) {
  if (!element) return;

  // Защита от повторного запуска анимации
  if (element.classList.contains('typing-active')) {
    return;
  }

  // Если элемент ещё не подготовлен — оборачиваем символы в .char и включаем режим анимации
  if (!element.classList.contains('typing-initialized')) {
    const text = element.textContent || '';
    
    // Сохраняем оригинальный текст в data-атрибуте
    element.setAttribute('data-original-text', text);
    
    element.innerHTML = '';
    element.classList.add('typing-animation', 'typing-initialized');

    // Разбиваем текст на слова и пробелы
    const words = text.split(/(\s+)/);

    words.forEach((word) => {
      if (word.match(/\s+/)) {
        // Пробелы и переносы строк остаются как текстовые узлы
        element.appendChild(document.createTextNode(word));
      } else if (word.length > 0) {
        // Каждое слово оборачиваем в span
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word';

        // Разбиваем слово на буквы
        const letters = word.split('');
        letters.forEach((letter) => {
          const letterSpan = document.createElement('span');
          letterSpan.className = 'char';
          letterSpan.textContent = letter;
          wordSpan.appendChild(letterSpan);
        });

        element.appendChild(wordSpan);
      }
    });
    
  } else {
    // Убедимся, что класс анимации включён при старте показа
    element.classList.add('typing-animation');
  }

  // Удаляем активность со всех символов перед запуском. Пробелы/переносы остаются текстовыми узлами.
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((el) => el.classList.remove('active'));

  // Отмечаем элемент как активный
  element.classList.add('typing-active');

  // Затем последовательно активируем символы с задержкой
  charElements.forEach((charEl, index) => {
    setTimeout(() => {
      charEl.classList.add('active');
    }, index * delay);
  });
}

/**
 * Запускает анимацию печатания для текста в секции
 */
function startTypingAnimation(section) {
  // Защита от повторного запуска анимации для секции
  if (section.classList.contains('typing-animation-running')) {
    return;
  }
  
  section.classList.add('typing-animation-running');
  
  const grayTexts = section.querySelectorAll('.gray_text');

  // Функция для запуска анимации элемента с ожиданием завершения предыдущего
  function animateTextSequentially(index = 0) {
    if (index >= grayTexts.length) {
      section.classList.remove('typing-animation-running');
      return;
    }

    const textElement = grayTexts[index];
    
    // Запускаем анимацию текущего элемента (это также инициализирует элемент)
    createTypingAnimation(textElement, 50);
    
    // Подсчитываем количество символов в текущем элементе после инициализации
    const chars = textElement.querySelectorAll('.char');
    const animationDuration = chars.length * 50; // 50мс на символ
    
    // После завершения анимации текущего элемента запускаем следующий
    setTimeout(() => {
      animateTextSequentially(index + 1);
    }, animationDuration + 200); // +200мс пауза между элементами
  }

  // Запускаем последовательную анимацию
  animateTextSequentially(0);
}

/**
 * Показывает определенную секцию и скрывает остальные
 */
function showSection(sectionIndex) {
  // Оптимизация: изменяем только если секция действительно изменилась
  if (currentSection === sectionIndex) return;

  $sections.forEach((section, index) => {
    if (index === sectionIndex) {
      section.classList.add('active');

      // Запускаем анимацию печатания для текста в этой секции
      setTimeout(() => {
        startTypingAnimation(section);
      }, 200); // Небольшая задержка после появления секции
    } else {
      section.classList.remove('active');

      // Убираем анимацию печатания у скрытых секций
      resetTypingAnimation(section);
    }
  });
  currentSection = sectionIndex;
  isShowingSection = true; // Устанавливаем флаг показа секции
}

/**
 * Восстанавливает оригинальный текст и убирает анимацию
 */
function resetTypingAnimation(section) {
  // Убираем флаг запущенной анимации секции
  section.classList.remove('typing-animation-running');
  
  const grayTexts = section.querySelectorAll('.gray_text');
  grayTexts.forEach((text) => {
    text.classList.remove('typing-animation', 'typing-active');

    // Убираем активность со всех символов
    const chars = text.querySelectorAll('.char');
    chars.forEach((char) => char.classList.remove('active'));

    // Если элемент был инициализирован, восстанавливаем оригинальный текст
    if (text.classList.contains('typing-initialized')) {
      // Сохраняем оригинальный текст в data-атрибуте при инициализации
      const originalText = text.getAttribute('data-original-text');
      if (originalText) {
        text.innerHTML = originalText;
        text.removeAttribute('data-original-text');
      }
      text.classList.remove('typing-initialized');
    }
  });
}

/**
 * Скрывает все секции (переходный режим)
 */
function hideAllSections() {
  // Оптимизация: скрываем только если есть активные секции
  if (currentSection === -1) return;

  $sections.forEach((section) => {
    section.classList.remove('active');

    // Убираем анимацию печатания у всех секций
    resetTypingAnimation(section);
  });
  currentSection = -1; // Никакая секция не активна
  isShowingSection = false; // Сбрасываем флаг показа секции
}

/**
 * Блокирует скролл
 */
function blockScroll() {
  isScrollBlocked = true;

  // Сохраняем текущую позицию скролла
  scrollPosition = window.scrollY;

  // Сохраняем текущее время видео
  videoTimeAtBlock = $video.currentTime || 0;

  // Блокируем overflow
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Принудительно возвращаем скролл к сохраненной позиции
  window.scrollTo(0, scrollPosition);
}

/**
 * Разблокирует скролл
 */
function unblockScroll() {
  isScrollBlocked = false;
  isShowingSection = false; // Сбрасываем флаг показа секции при разблокировке

  // Восстанавливаем overflow
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';

  // Восстанавливаем время видео к моменту блокировки
  if ($video.readyState >= 2) {
    $video.currentTime = videoTimeAtBlock;
  }

  // Оставляем скролл на той же позиции (никаких накоплений)
  window.scrollTo(0, scrollPosition);
}

/**
 * Проверяет, нужно ли показать секцию на основе времени видео
 */
function checkSectionDisplay() {
  const currentVideoTime = $video.currentTime || 0;

  // Проверяем валидность времени видео
  if (!isFinite(currentVideoTime) || currentVideoTime < 0) {
    return;
  }

  let foundSection = false;

  // Проверяем каждый таймкод
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [startTime] = SEGMENTS[i];

    // Проверяем валидность таймкода
    if (!isFinite(startTime) || startTime < 0) {
      continue;
    }

    // Если видео дошло до таймкода секции (с погрешностью 0.5 сек)
    if (Math.abs(currentVideoTime - startTime) < 0.5) {
      foundSection = true;
      if (i !== currentSection) {
        showSection(i);
        blockScroll();

        // Разблокируем скролл через указанное время
        setTimeout(() => {
          unblockScroll();
        }, PAUSE_DURATION);
      }
      return;
    }
  }

  // Если мы не находимся в зоне показа секции, скрываем все секции (переходный режим)
  // НО только если мы не в процессе показа секции (во время блокировки скролла)
  if (!foundSection && currentSection !== -1 && !isShowingSection) {
    hideAllSections();
  }
}

/**
 * Основной цикл анимации
 */
function tick() {
  // Получаем прогресс скролла (0-1)
  const scrollProgress = getScrollProgress();

  // Вычисляем целевое время видео
  const videoDuration = $video.duration || 30;
  let targetTime = scrollProgress * videoDuration;

  // Применяем ускорение от скорости скролла (если включено)
  if (VELOCITY_BOOST !== 0) {
    const dy = window.scrollY - (window.lastScrollY || window.scrollY);
    window.lastScrollY = window.scrollY;
    const scrollVel = Math.sign(dy);
    targetTime +=
      scrollVel *
      Math.min(Math.abs(dy) / 1000, 1) *
      videoDuration *
      VELOCITY_BOOST;
    targetTime = Math.max(0, Math.min(targetTime, videoDuration));
  }

  // Обновляем время видео только если скролл не заблокирован
  if (!isScrollBlocked) {
    // Плавное сглаживание времени видео
    const currentTime = $video.currentTime || 0;
    const smoothedTime = currentTime + (targetTime - currentTime) * LERP_ALPHA;

    // Применяем время к видео
    if ($video.readyState >= 2 && !$video.seeking) {
      if (isFinite(smoothedTime) && smoothedTime >= 0) {
        $video.currentTime = smoothedTime;
      }
    }
  }

  // Проверяем секции только каждые SECTION_CHECK_INTERVAL миллисекунд
  const now = performance.now();
  if (now - lastSectionCheck >= SECTION_CHECK_INTERVAL) {
    checkSectionDisplay();
    lastSectionCheck = now;
  }

  // Продолжаем цикл
  requestAnimationFrame(tick);
}

/**
 * Обработчик для предотвращения скролла во время блокировки
 */
function preventScroll(e) {
  if (isScrollBlocked) {
    e.preventDefault();
    e.stopPropagation();

    // Принудительно возвращаем скролл к сохраненной позиции
    window.scrollTo(0, scrollPosition);

    return false;
  }
}

/**
 * Простая инициализация видео
 */
function initVideo() {
  $video.currentTime = 0;
  $video.muted = true;
  
  // Для iOS добавляем специальные атрибуты
  $video.setAttribute('playsinline', '');
  $video.setAttribute('webkit-playsinline', '');
  $video.setAttribute('muted', '');
  $video.setAttribute('preload', 'metadata');
  
  // Убираем autoplay и controls для iOS
  $video.removeAttribute('autoplay');
  $video.removeAttribute('controls');
}

/**
 * Переключает состояние звука
 */
function toggleSound() {
  isSoundOn = !isSoundOn;
  updateSoundButton();
  
  // Сохраняем состояние в localStorage
  localStorage.setItem('astarta-sound-enabled', isSoundOn.toString());
}

/**
 * Обновляет внешний вид кнопки звука
 */
function updateSoundButton() {
  if (!$soundButton || !$soundButtonWrap) return;

  const spanElement = $soundButton.querySelector('span');
  
  if (isSoundOn) {
    // Звук включен
    $soundButtonWrap.classList.remove('sound-off');
    $soundButton.setAttribute('aria-label', 'выключить звук');
    if (spanElement) {
      spanElement.textContent = 'Sound On';
    }
  } else {
    // Звук выключен
    $soundButtonWrap.classList.add('sound-off');
    $soundButton.setAttribute('aria-label', 'включить звук');
    if (spanElement) {
      spanElement.textContent = 'Sound Off';
    }
  }
}

/**
 * Загружает сохраненное состояние звука
 */
function loadSoundState() {
  const savedState = localStorage.getItem('astarta-sound-enabled');
  if (savedState !== null) {
    isSoundOn = savedState === 'true';
  }
}

/**
 * Инициализирует кнопку звука
 */
function initSoundButton() {
  if (!$soundButton) return;

  // Загружаем сохраненное состояние
  loadSoundState();

  // Устанавливаем начальное состояние
  updateSoundButton();

  // Добавляем обработчик клика
  $soundButton.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSound();
  });
}


/**
 * Инициализация при загрузке страницы
 */
window.addEventListener('load', () => {
  // Инициализируем видео
  initVideo();

  // Инициализируем кнопку звука
  initSoundButton();

  // Изначально скрываем все секции (переходный режим)
  hideAllSections();

  // Добавляем обработчики блокировки скролла
  window.addEventListener('wheel', preventScroll, { passive: false });
  window.addEventListener('touchmove', preventScroll, { passive: false });
  window.addEventListener('scroll', preventScroll, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (
      isScrollBlocked &&
      [32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)
    ) {
      e.preventDefault();
    }
  });

  // Запускаем основной цикл
  requestAnimationFrame(tick);
});

/**
 * Обработчик загрузки метаданных видео
 */
$video.addEventListener('loadedmetadata', () => {
  $video.pause();
  $video.currentTime = 0;
});

/**
 * Обработчик для iOS - запуск видео при первом взаимодействии
 */
let hasUserInteracted = false;

function handleFirstUserInteraction() {
  if (!hasUserInteracted) {
    hasUserInteracted = true;
    
    // Пытаемся запустить видео
    const playPromise = $video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Игнорируем ошибки автовоспроизведения
      });
    }
    
    // Убираем обработчики после первого взаимодействия
    document.removeEventListener('touchstart', handleFirstUserInteraction);
    document.removeEventListener('click', handleFirstUserInteraction);
  }
}

// Добавляем обработчики для первого взаимодействия
document.addEventListener('touchstart', handleFirstUserInteraction, { once: true });
document.addEventListener('click', handleFirstUserInteraction, { once: true });
