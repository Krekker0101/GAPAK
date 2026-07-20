import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './app/globals.css';

const themeBootstrapScript = `
(function () {
  try {
    var root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    root.dataset.theme = "light";
    try { window.localStorage.setItem("gapak-theme", "light"); } catch (e) {}
  } catch (error) {}
})();
`;

const hydrationAttributeSanitizer = `
(function () {
  var blockedExact = { bis_skin_checked: true, bis_register: true };
  var blockedPrefix = "__processed_";

  function cleanNode(node) {
    if (!node || node.nodeType !== 1 || !node.attributes) {
      return;
    }

    var attributes = Array.prototype.slice.call(node.attributes);
    for (var i = 0; i < attributes.length; i += 1) {
      var name = attributes[i].name;
      if (blockedExact[name] || name.indexOf(blockedPrefix) === 0) {
        node.removeAttribute(name);
      }
    }
  }

  function cleanTree() {
    cleanNode(document.documentElement);
    if (document.body) {
      cleanNode(document.body);
    }

    var nodes = document.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i += 1) {
      cleanNode(nodes[i]);
    }
  }

  cleanTree();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanTree, { once: true });
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      cleanNode(mutations[i].target);
      for (var j = 0; j < mutations[i].addedNodes.length; j += 1) {
        cleanNode(mutations[i].addedNodes[j]);
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true
  });

  window.setTimeout(cleanTree, 0);
  window.setTimeout(cleanTree, 50);
  window.setTimeout(cleanTree, 250);
  window.setTimeout(function () {
    cleanTree();
    observer.disconnect();
  }, 3000);
})();
`;

// Execute bootstrap scripts
try {
  eval(themeBootstrapScript);
  eval(hydrationAttributeSanitizer);
} catch (error) {
  console.error('Error executing bootstrap scripts:', error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
