import { SEGMENTS } from './timecode';

/**
 * Система скролл-видео с показом секций по таймкодам и интро
 */

// DOM элементы
const $video = document.getElementById('video');                    // Основное видео
const $sections = Array.from(document.querySelectorAll('.section')); // Все секции контента
const $soundButton = document.querySelector('.toggle-sound');      // Кнопка звука
const $soundButtonWrap = document.querySelector('.sound_button_wrap'); // Обертка кнопки звука
const $videoLoader = document.getElementById('video-loader');       // Лоадер видео
const $loaderProgressBar = document.getElementById('loader-progress-bar'); // Прогресс-бар лоадера

// Переменные состояния
let currentSection = -1;           // Индекс текущей активной секции (-1 = нет активной)
let isScrollBlocked = false;       // Заблокирован ли скролл (во время показа секции)
let lastSectionCheck = 0;          // Время последней проверки секций (для оптимизации)
let isShowingSection = false;      // Показывается ли секция в данный момент
let videoTimeAtBlock = 0;          // Время видео в момент блокировки скролла
let scrollPositionAtBlock = 0;     // Позиция скролла в момент блокировки
let isSoundOn = true;              // Включен ли звук
let isIntroPlaying = true;         // Идет ли интро
let hasUserInteracted = false;     // Было ли взаимодействие пользователя
let isVideoLoaded = false;         // Загружено ли видео полностью
let isLoaderVisible = true;        // Виден ли лоадер

// Настройки
const SECTION_CHECK_INTERVAL = 100; // Интервал проверки секций (мс)
const INTRO_END_TIME = 4.3;         // Время окончания интро (секунды)

// Переменные для отслеживания изменений (оптимизация)
let lastVideoTime = 0;              // Последнее время видео
let lastScrollProgress = 0;         // Последний прогресс скролла
let lastActiveSection = -1;         // Последняя активная секция

// Настройки для разных устройств
const DEVICE_CONFIG = {
  mobile: {
    lerpAlpha: 0.10,        // Коэффициент сглаживания видео (0-1, чем меньше - тем плавнее)
    pauseDuration: 1500,    // Длительность блокировки скролла при показе секции (мс)
    typingDelay: 50,        // Задержка между появлением символов в анимации печати (мс)
    typingPause: 200,       // Пауза между анимацией разных текстовых блоков (мс)
    scrollSensitivity: 1.2, // Чувствительность скролла (1.5 = в полтора раза быстрее)
  },
  tablet: {
    lerpAlpha: 0.10,        // Коэффициент сглаживания видео (0-1, чем меньше - тем плавнее)
    pauseDuration: 1500,    // Длительность блокировки скролла при показе секции (мс)
    typingDelay: 50,        // Задержка между появлением символов в анимации печати (мс)
    typingPause: 200,       // Пауза между анимацией разных текстовых блоков (мс)
    scrollSensitivity: 1.2, // Чувствительность скролла (1.5 = в полтора раза быстрее)
  },
  desktop: {
    lerpAlpha: 0.05,        // Коэффициент сглаживания видео (0-1, чем меньше - тем плавнее)
    pauseDuration: 1500,    // Длительность блокировки скролла при показе секции (мс)
    typingDelay: 50,        // Задержка между появлением символов в анимации печати (мс)
    typingPause: 200,       // Пауза между анимацией разных текстовых блоков (мс)
    scrollSensitivity: 1.2, // Чувствительность скролла (1.5 = в полтора раза быстрее)
  },
};

/**
 * Определяет тип устройства для применения соответствующих настроек
 * @returns {string} 'mobile', 'tablet' или 'desktop'
 */
function getDeviceType() {
  const width = window.innerWidth;
  const isTouch = 'ontouchstart' in window; // Проверяем поддержку тач-событий

  if (width <= 768 || (isTouch && width <= 1024)) {
    return 'mobile';    // Мобильные устройства
  } else if (width <= 1024 || (isTouch && width <= 1440)) {
    return 'tablet';    // Планшеты
  } else {
    return 'desktop';   // Десктопы
  }
}

// Текущая конфигурация устройства
let deviceConfig = DEVICE_CONFIG[getDeviceType()];

// Кэш для элементов интерфейса
const interfaceElements = {
  header: null,
  soundButton: null,
  arrowDown: null,
};

/**
 * Получает прогресс скролла от 0 до 1 с учетом типа устройства
 * @returns {number} Прогресс скролла от 0 до 0.99
 */
function getScrollProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight; // Максимальный скролл
  const progress = window.scrollY / maxScroll; // Текущий прогресс скролла (0-1)

  // Применяем чувствительность скролла для разных устройств
  const adjustedProgress = progress * deviceConfig.scrollSensitivity;

  // Ограничиваем прогресс от 0 до 0.99 для полного скролла (0.99 вместо 1 для стабильности)
  return Math.min(Math.max(adjustedProgress, 0), 0.99);
}

/**
 * Создает анимацию печатания для элемента (появление текста по буквам)
 * @param {HTMLElement} element - Элемент с текстом для анимации
 * @param {number} delay - Задержка между символами (мс), если не указана - используется из конфига
 */
function createTypingAnimation(element, delay = null) {
  // Используем адаптивную задержку если не указана
  const typingDelay = delay || deviceConfig.typingDelay;
  if (!element) return; // Проверяем, что элемент существует

  // Сбрасываем предыдущую анимацию если она была активна
  if (element.classList.contains('typing-active')) {
    element.classList.remove('typing-active');
    // Очищаем все таймауты для этого элемента
    const charElements = element.querySelectorAll('.char');
    charElements.forEach((el) => el.classList.remove('active'));
  }

  // Инициализация элемента если нужно
  if (!element.classList.contains('typing-initialized')) {
    const text = element.textContent || '';
    element.setAttribute('data-original-text', text);
    element.innerHTML = '';
    element.classList.add('typing-animation', 'typing-initialized');

    // Разбиваем текст на слова и пробелы
    const words = text.split(/(\s+)/);
    words.forEach((word) => {
      if (word.match(/\s+/)) {
        element.appendChild(document.createTextNode(word));
      } else if (word.length > 0) {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word';

        word.split('').forEach((letter) => {
          const letterSpan = document.createElement('span');
          letterSpan.className = 'char';
          letterSpan.textContent = letter;
          wordSpan.appendChild(letterSpan);
        });

        element.appendChild(wordSpan);
      }
    });
  } else {
    element.classList.add('typing-animation');
  }

  // Активируем анимацию
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((el) => el.classList.remove('active'));
  element.classList.add('typing-active');

  charElements.forEach((charEl, index) => {
        setTimeout(() => {
      // Проверяем, что анимация все еще активна перед добавлением класса
      if (element.classList.contains('typing-active')) {
        charEl.classList.add('active');
      }
    }, index * typingDelay);
  });
}

/**
 * Запускает анимацию печатания для секции
 */
function startTypingAnimation(section) {
  // Если анимация уже запущена, сначала останавливаем её
  if (section.classList.contains('typing-animation-running')) {
    resetTypingAnimation(section);
  }

  section.classList.add('typing-animation-running');
  const grayTexts = section.querySelectorAll('.gray_text');
  
  function animateTextSequentially(index = 0) {
    // Проверяем, что анимация все еще должна продолжаться
    if (!section.classList.contains('typing-animation-running') || index >= grayTexts.length) {
      section.classList.remove('typing-animation-running');
      return;
    }

    const textElement = grayTexts[index];
    createTypingAnimation(textElement);

    const chars = textElement.querySelectorAll('.char');
    const animationDuration = chars.length * deviceConfig.typingDelay;

    setTimeout(
      () => animateTextSequentially(index + 1),
      animationDuration + deviceConfig.typingPause,
    );
  }

  animateTextSequentially(0);
}

/**
 * Восстанавливает оригинальный текст
 */
function resetTypingAnimation(section) {
  section.classList.remove('typing-animation-running');

  section.querySelectorAll('.gray_text').forEach((text) => {
    // Полностью останавливаем анимацию
    text.classList.remove('typing-animation', 'typing-active');
    
    // Убираем активные классы с символов
    text.querySelectorAll('.char').forEach((char) => char.classList.remove('active'));

    // Восстанавливаем оригинальный текст
    if (text.classList.contains('typing-initialized')) {
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
 * Показывает секцию
 */
function showSection(sectionIndex) {
  if (currentSection === sectionIndex) return;

  $sections.forEach((section, index) => {
    if (index === sectionIndex) {
      section.classList.add('active');
      setTimeout(() => startTypingAnimation(section), deviceConfig.typingPause);
    } else {
      section.classList.remove('active');
      resetTypingAnimation(section);
    }
  });

  // Управляем видимостью текста кнопки звука
  if ($soundButtonWrap) {
    if (sectionIndex === 6) { // Последняя секция (форма)
      $soundButtonWrap.classList.add('hide-text');
    } else {
      $soundButtonWrap.classList.remove('hide-text');
    }
  }

  currentSection = sectionIndex;
  isShowingSection = true;
}

/**
 * Скрывает все секции
 */
function hideAllSections() {
  if (currentSection === -1) return;

  $sections.forEach((section) => {
    section.classList.remove('active');
    resetTypingAnimation(section);
  });

  // Убираем класс скрытия текста кнопки звука
  if ($soundButtonWrap) {
    $soundButtonWrap.classList.remove('hide-text');
  }

  currentSection = -1;
  isShowingSection = false;
}

/**
 * Устанавливает overflow стили
 */
function setOverflowStyle(overflow) {
  document.body.style.overflow = overflow;
  document.documentElement.style.overflow = overflow;
}

/**
 * Блокирует скролл
 */
function blockScroll() {
  isScrollBlocked = true;
  videoTimeAtBlock = $video.currentTime || 0;
  scrollPositionAtBlock = window.scrollY; // Сохраняем текущую позицию скролла

  // Принудительно останавливаем видео на нужном кадре
  if ($video.readyState >= 2) {
    $video.pause();
    $video.currentTime = videoTimeAtBlock;
    // Дополнительно убеждаемся, что видео остановлено
    setTimeout(() => {
      if (isScrollBlocked && !$video.paused) {
        $video.pause();
        $video.currentTime = videoTimeAtBlock;
      }
    }, 50);
  }

  setOverflowStyle('hidden');
}

/**
 * Разблокирует скролл
 */
function unblockScroll() {
  isScrollBlocked = false;
  isShowingSection = false;

  setOverflowStyle('');
  
  // Сбрасываем накопленный скролл на мобильных устройствах
  const isTouchDevice = 'ontouchstart' in window;
  if (isTouchDevice) {
    // Возвращаемся к позиции скролла в момент блокировки
    window.scrollTo(0, scrollPositionAtBlock);
    
    // Дополнительно фиксируем позицию через небольшую задержку
      setTimeout(() => {
      window.scrollTo(0, scrollPositionAtBlock);
    }, 10);
    
    // Еще один финальный сброс для надежности
    setTimeout(() => {
      window.scrollTo(0, scrollPositionAtBlock);
    }, 50);
  }

  // Восстанавливаем точное время видео без запуска воспроизведения
  if ($video.readyState >= 2) {
    $video.currentTime = videoTimeAtBlock;
    // НЕ запускаем play() - видео будет управляться скроллом
  }
}

/**
 * Проверяет отображение секций
 */
function checkSectionDisplay() {
  const currentVideoTime = $video.currentTime || 0;

  if (!isFinite(currentVideoTime) || currentVideoTime < 0) return;

  let foundSection = false;

  for (let i = 0; i < SEGMENTS.length; i++) {
    const [startTime] = SEGMENTS[i];

    if (!isFinite(startTime) || startTime < 0) continue;

    if (Math.abs(currentVideoTime - startTime) < 0.5) {
      foundSection = true;
      if (i !== currentSection) {
        showSection(i);
        blockScroll();
        setTimeout(unblockScroll, deviceConfig.pauseDuration);
      }
    return;
  }
  }

  if (!foundSection && currentSection !== -1 && !isShowingSection) {
    hideAllSections();
  }
}

/**
 * Основной цикл анимации - вызывается каждый кадр
 * Управляет воспроизведением видео, скроллом и показом секций
 */
function tick() {
  // Принудительно сбрасываем скролл в начале, если мы в интро
  if (isIntroPlaying && window.scrollY > 0) {
    resetScrollPosition();
  }

  // Если идет интро - ждем его окончания
  if (isIntroPlaying) {
    if ($video.currentTime >= INTRO_END_TIME) {
      finishIntro(); // Завершаем интро и переходим к основному режиму
    }
    requestAnimationFrame(tick);
    return;
  }

  // Проверяем базовую готовность видео (ReadyState 1 достаточно для метаданных)
  if ($video.readyState < 1) {
    requestAnimationFrame(tick);
    return;
  }

  const scrollProgress = getScrollProgress(); // Получаем прогресс скролла (0-0.99)
  const videoDuration = $video.duration || 30; // Длительность видео (fallback 30s)

  // Используем полную длительность видео для точного расчета
  // targetTime = время интро + (прогресс скролла * оставшееся время)
  const targetTime = INTRO_END_TIME + Math.max(0, scrollProgress) * (videoDuration - INTRO_END_TIME);

  // Отслеживаем изменения для оптимизации (избегаем лишних вычислений)
  const currentVideoTime = $video.currentTime;
  const currentScrollProgress = Math.round(scrollProgress * 100) / 100;

  if (
    Math.abs(currentVideoTime - lastVideoTime) > 0.1 ||
    Math.abs(currentScrollProgress - lastScrollProgress) > 0.01
  ) {
    lastVideoTime = currentVideoTime;
    lastScrollProgress = currentScrollProgress;
  }

  // Обновляем время видео только если скролл не заблокирован
  if (!isScrollBlocked) {
    const currentTime = $video.currentTime || 0;
    // Сглаживаем переход к целевому времени (lerp - linear interpolation)
    const smoothedTime = currentTime + (targetTime - currentTime) * deviceConfig.lerpAlpha;

    // Позволяем видео доходить до самого конца (работаем даже с ReadyState 1)
    if ($video.readyState >= 1 && !$video.seeking) {
      if (isFinite(smoothedTime) && smoothedTime >= 0) {
        // Если целевое время больше длительности видео, устанавливаем максимальное возможное время
        const finalTime = Math.min(smoothedTime, videoDuration);
        try {
          $video.currentTime = finalTime; // Устанавливаем новое время видео
        } catch (error) {
          // Игнорируем ошибки установки времени видео (например, если видео еще загружается)
        }
      }
    }
      } else {
    // Во время блокировки принудительно останавливаем видео на нужном кадре
    if (!$video.paused) {
      $video.pause();
      $video.currentTime = videoTimeAtBlock; // Возвращаем к времени блокировки
    }
  }

  const now = performance.now();
  // Проверяем секции с интервалом для оптимизации производительности
  if (now - lastSectionCheck >= SECTION_CHECK_INTERVAL) {
    checkSectionDisplay(); // Проверяем, какую секцию нужно показать
    lastSectionCheck = now;

    // Отслеживаем изменения секции для внутренней логики
    if (currentSection !== lastActiveSection && currentSection >= 0) {
      lastActiveSection = currentSection;
    }
  }

  requestAnimationFrame(tick); // Планируем следующий кадр
}

/**
 * Предотвращает скролл во время блокировки
 */
function preventScroll(e) {
  if (isScrollBlocked) {
    e.preventDefault();
    e.stopPropagation();
    
    // Дополнительно для мобильных устройств принудительно фиксируем позицию
    const isTouchDevice = 'ontouchstart' in window;
    if (isTouchDevice && e.type === 'touchmove') {
      // Принудительно возвращаемся к сохраненной позиции
      setTimeout(() => {
        window.scrollTo(0, scrollPositionAtBlock);
      }, 0);
    }
    
    return false;
  }
}

/**
 * Управление интерфейсом
 */
function toggleInterface(show) {
  // Кэшируем элементы при первом вызове
  if (!interfaceElements.header) {
    interfaceElements.header = document.querySelector('header');
    interfaceElements.soundButton =
      document.querySelector('.sound_button_wrap');
    interfaceElements.arrowDown = document.querySelector('.arrow_down_wrap');
  }

  const display = show ? '' : 'none';
  const visibility = show ? 'visible' : 'hidden';
  const opacity = show ? '1' : '0';

  if (interfaceElements.header) {
    interfaceElements.header.style.display = display;
    interfaceElements.header.style.visibility = visibility;
    interfaceElements.header.style.opacity = opacity;
  }
  if (interfaceElements.soundButton) {
    interfaceElements.soundButton.style.display = display;
    interfaceElements.soundButton.style.visibility = visibility;
    interfaceElements.soundButton.style.opacity = opacity;
  }
  if (interfaceElements.arrowDown) {
    interfaceElements.arrowDown.style.display = display;
    interfaceElements.arrowDown.style.visibility = visibility;
    interfaceElements.arrowDown.style.opacity = opacity;
  }
}

/**
 * Блокирует все взаимодействия
 */
function blockAllInteractions() {
  setOverflowStyle('hidden');

  const events = ['wheel', 'touchmove', 'scroll', 'keydown', 'click'];
  events.forEach((event) => {
    document.addEventListener(event, preventAllInteractions, {
      passive: false,
    });
  });
}

/**
 * Разблокирует взаимодействия
 */
function unblockAllInteractions() {
  setOverflowStyle('');

  const events = ['wheel', 'touchmove', 'scroll', 'keydown', 'click'];
  events.forEach((event) => {
    document.removeEventListener(event, preventAllInteractions);
  });
}

/**
 * Предотвращает все взаимодействия
 */
function preventAllInteractions(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

/**
 * Завершает интро
 */
function finishIntro() {
  isIntroPlaying = false;
  
  // Убеждаемся, что лоадер скрыт
  if (isLoaderVisible) {
    hideVideoLoader();
  }
  
  toggleInterface(true);
  unblockAllInteractions();
  $video.currentTime = INTRO_END_TIME;
  $video.removeAttribute('autoplay'); // Убираем автоплей после интро
  hideAllSections();
}

/**
 * Инициализация видео
 */
function initVideo() {
  // Принудительно сбрасываем позицию скролла и время видео
  resetScrollPosition();
  $video.currentTime = 0;
  $video.muted = true;

  // iOS атрибуты
  $video.setAttribute('playsinline', '');
  $video.setAttribute('webkit-playsinline', '');
  $video.setAttribute('muted', '');
  $video.removeAttribute('controls');

  toggleInterface(false);
  blockAllInteractions();

  // Автоматически запускаем интро только после полной загрузки
  $video.addEventListener('canplaythrough', () => {
    if (isVideoLoaded && !hasUserInteracted) {
      setTimeout(() => {
        const playPromise = $video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Если автовоспроизведение заблокировано, ждем взаимодействия пользователя
          });
        }
      }, 500);
    }
  });
}

/**
 * Управление звуком
 */
function toggleSound() {
  isSoundOn = !isSoundOn;
  updateSoundButton();
  localStorage.setItem('astarta-sound-enabled', isSoundOn.toString());
}

function updateSoundButton() {
  if (!$soundButton || !$soundButtonWrap) return;

  const spanElement = $soundButton.querySelector('span');

  if (isSoundOn) {
    $soundButtonWrap.classList.remove('sound-off');
    $soundButton.setAttribute('aria-label', 'выключить звук');
    if (spanElement) spanElement.textContent = 'Sound On';
    } else {
    $soundButtonWrap.classList.add('sound-off');
    $soundButton.setAttribute('aria-label', 'включить звук');
    if (spanElement) spanElement.textContent = 'Sound Off';
  }
}

function loadSoundState() {
  const savedState = localStorage.getItem('astarta-sound-enabled');
  if (savedState !== null) {
    isSoundOn = savedState === 'true';
  }
}

function initSoundButton() {
  if (!$soundButton) return;

  loadSoundState();
  updateSoundButton();

  $soundButton.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSound();
  });
}

/**
 * Обработчик первого взаимодействия (только если автовоспроизведение заблокировано)
 */
function handleFirstUserInteraction() {
  if (!hasUserInteracted && isIntroPlaying) {
    hasUserInteracted = true;

    const playPromise = $video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }

    document.removeEventListener('touchstart', handleFirstUserInteraction);
    document.removeEventListener('click', handleFirstUserInteraction);
  }
}

/**
 * Обновляет конфигурацию устройства при изменении размера окна
 */
function updateDeviceConfig() {
  deviceConfig = DEVICE_CONFIG[getDeviceType()];
}

/**
 * Сброс позиции скролла при загрузке
 */
function resetScrollPosition() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Принудительно сбрасываем в истории браузера
  if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
  }
}

/**
 * Управление лоадером видео
 */
function showVideoLoader() {
  if (!$videoLoader) return;
  
  isLoaderVisible = true;
  $videoLoader.classList.remove('hidden');
}

function hideVideoLoader() {
  if (!$videoLoader) return;
  
  isLoaderVisible = false;
  $videoLoader.classList.add('hidden');
  
  // Удаляем лоадер из DOM через некоторое время после скрытия
  setTimeout(() => {
    if ($videoLoader && !isLoaderVisible) {
      $videoLoader.remove();
    }
  }, 500);
}

function updateLoaderProgress(progress) {
  if (!$loaderProgressBar) return;
  
  const percentage = Math.min(Math.max(progress * 100, 0), 100);
  $loaderProgressBar.style.width = `${percentage}%`;
}

/**
 * Инициализация лоадера видео
 */
function initVideoLoader() {
  if (!$videoLoader || !$video) return;
  
  showVideoLoader();
  
  // Обработчики событий загрузки видео
  $video.addEventListener('loadstart', () => {
    updateLoaderProgress(0);
  });
  
  $video.addEventListener('progress', () => {
    if ($video.buffered.length > 0) {
      const bufferedEnd = $video.buffered.end($video.buffered.length - 1);
      const duration = $video.duration;
      
      if (duration > 0) {
        const progress = bufferedEnd / duration;
        updateLoaderProgress(progress);
      }
    }
  });
  
  $video.addEventListener('canplaythrough', () => {
    isVideoLoaded = true;
    updateLoaderProgress(1);
    
    // Небольшая задержка перед скрытием лоадера для плавности
    setTimeout(() => {
      if (isVideoLoaded) {
        hideVideoLoader();
      }
    }, 300);
  });
  
  $video.addEventListener('error', () => {
    console.error('Ошибка загрузки видео');
    hideVideoLoader();
  });
  
  // Таймаут на случай, если видео не загрузится за разумное время
  setTimeout(() => {
    if (!isVideoLoaded && isLoaderVisible) {
      console.warn('Таймаут загрузки видео, скрываем лоадер');
      hideVideoLoader();
    }
  }, 30000); // 30 секунд
}

/**
 * Инициализация
 */
// Сбрасываем скролл и скрываем интерфейс сразу при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  resetScrollPosition();
  toggleInterface(false);
});

window.addEventListener('load', () => {
  // Принудительно сбрасываем позицию скролла
  resetScrollPosition();

  // Дополнительно сбрасываем с задержкой для перебивания браузерного восстановления
  setTimeout(resetScrollPosition, 0);
  setTimeout(resetScrollPosition, 10);
  setTimeout(resetScrollPosition, 100);

  // Скрываем интерфейс сразу при загрузке
  toggleInterface(false);
  
  initVideoLoader(); // Инициализируем лоадер первым
  initVideo();
  initSoundButton();
  hideAllSections();

  // Обработчик изменения размера окна
  window.addEventListener('resize', updateDeviceConfig);

  // Обработчики блокировки скролла
  const scrollEvents = ['wheel', 'touchmove', 'scroll'];

  scrollEvents.forEach((event) => {
    // Всегда используем passive: false для возможности preventDefault
    window.addEventListener(event, preventScroll, { passive: false });
  });

  window.addEventListener('keydown', (e) => {
    if (
      isScrollBlocked &&
      [32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)
    ) {
      e.preventDefault();
    }
  });

  requestAnimationFrame(tick);
});

/**
 * Обработчики видео
 */
// $video.addEventListener('loadedmetadata', () => {
//   // Не останавливаем видео, если идет интро
//   if (!isIntroPlaying) {
//     $video.pause();
//     $video.currentTime = 0;
//   }
// });


// Обработчики первого взаимодействия
document.addEventListener('touchstart', handleFirstUserInteraction, {
  once: true,
});
document.addEventListener('click', handleFirstUserInteraction, { once: true });
