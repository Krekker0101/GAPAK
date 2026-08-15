(function() {
  try {
    var target = window;
    var prop = 'fetch';
    var origFetch = target[prop];
    if (typeof origFetch === 'function') {
      var currentFetch = origFetch;
      Object.defineProperty(target, prop, {
        get: function() { return currentFetch; },
        set: function(v) { currentFetch = v; },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    console.warn('[GAPAK Runtime] Fetch property descriptor patch:', e);
  }
})();
