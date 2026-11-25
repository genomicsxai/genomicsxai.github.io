// <stdin>
var wrap = (figures) => {
  const galleryContainer = document.createElement("div");
  galleryContainer.className = "gallery";
  const parentNode = figures[0].parentNode, first = figures[0];
  parentNode.insertBefore(galleryContainer, first);
  for (const figure of figures) {
    galleryContainer.appendChild(figure);
  }
};
var unescapeHtml = (html) => {
  return html.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
};
var stdin_default = (container) => {
  const images = container.querySelectorAll("img.gallery-image");
  for (const img of Array.from(images)) {
    const paragraph = img.closest("p");
    if (!paragraph || !container.contains(paragraph)) continue;
    if (paragraph.textContent.trim() == "") {
      paragraph.classList.add("no-text");
    }
    let isNewLineImage = paragraph.classList.contains("no-text");
    if (!isNewLineImage) continue;
    const hasLink = img.parentElement.tagName == "A";
    let el = img;
    const figure = document.createElement("figure");
    figure.classList.add("gallery-image");
    figure.style.setProperty("flex-grow", img.getAttribute("data-flex-grow") || "1");
    figure.style.setProperty("flex-basis", img.getAttribute("data-flex-basis") || "0");
    if (hasLink) {
      el = img.parentElement;
      el.classList.add("image-link");
      el.setAttribute("data-pswp-width", img.getAttribute("width"));
      el.setAttribute("data-pswp-height", img.getAttribute("height"));
    } else {
      const a = document.createElement("a");
      a.href = img.src;
      a.setAttribute("class", "image-link");
      a.setAttribute("target", "_blank");
      a.setAttribute("data-pswp-width", img.getAttribute("width"));
      a.setAttribute("data-pswp-height", img.getAttribute("height"));
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);
      el = a;
    }
    el.parentElement.insertBefore(figure, el);
    figure.appendChild(el);
    let caption = img.getAttribute("alt");
    if (img.getAttribute("data-title-escaped")) {
      caption = unescapeHtml(img.getAttribute("data-title-escaped"));
    }
    if (caption) {
      const figcaption = document.createElement("figcaption");
      figcaption.innerHTML = caption;
      figure.appendChild(figcaption);
    }
  }
  const figuresEl = container.querySelectorAll("figure.gallery-image");
  let currentGallery = [];
  for (const figure of Array.from(figuresEl)) {
    if (!currentGallery.length) {
      currentGallery = [figure];
    } else if (figure.previousElementSibling === currentGallery[currentGallery.length - 1]) {
      currentGallery.push(figure);
    } else if (currentGallery.length) {
      wrap(currentGallery);
      currentGallery = [figure];
    }
  }
  if (currentGallery.length > 0) {
    wrap(currentGallery);
  }
};
export {
  stdin_default as default
};
