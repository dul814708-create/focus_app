export function createTimer({ totalSeconds, onTick, onComplete }) {
  let remaining = totalSeconds;
  let intervalId = null;

  function tick() {
    remaining -= 1;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      onComplete({ completed: true, actualSeconds: totalSeconds });
    }
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (intervalId) {
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
