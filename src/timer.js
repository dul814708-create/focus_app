export function createTimer({ totalSeconds, onTick, onComplete }) {
  let remaining = totalSeconds;
  let intervalId = null;
  let endAt = null; // timestamp (ms) the timer should reach 0

  function computeRemaining() {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }

  function tick() {
    remaining = computeRemaining();
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      onComplete({ completed: true, actualSeconds: totalSeconds });
    }
  }

  function start() {
    if (intervalId) return;
    endAt = Date.now() + remaining * 1000;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (intervalId) {
      remaining = computeRemaining();
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function resume() {
    start();
  }

  function reset() {
    pause();
    remaining = totalSeconds;
    onTick(remaining);
  }

  function skip() {
    pause();
    const actualSeconds = totalSeconds - remaining;
    onComplete({ completed: false, actualSeconds });
  }

  function getRemaining() {
    return remaining;
  }

  return { start, pause, resume, reset, skip, getRemaining };
}
