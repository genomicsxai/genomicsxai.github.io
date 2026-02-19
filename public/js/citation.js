(function() {
  function initCitationBox(box) {
    if (!box) return;
    var copyBtn = box.querySelector('.citation-copy-btn');
    var feedback = box.querySelector('.citation-copy-feedback');
    function getData(btn) {
      try {
        var raw = btn && btn.getAttribute('data-citation-data');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var d = getData(copyBtn);
        if (!d || !d.citation) return;
        navigator.clipboard.writeText(d.citation).then(function() {
          if (feedback) { feedback.textContent = ' Copied!'; setTimeout(function() { feedback.textContent = ''; }, 2000); }
        }).catch(function() {
          if (feedback) feedback.textContent = ' Copy failed';
        });
      });
    }
    box.querySelectorAll('.citation-download-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var d = getData(btn);
        if (!d) return;
        var format = btn.getAttribute('data-download');
        var blob, name;
        if (format === 'bib') {
          var authors = (d.authors && d.authors.length) ? d.authors.join(' and ') : 'Unknown';
          var rb = '\u007D';
          var lb = '\u007B';
          var titleBib = (d.title || '').replace(/\{/g, '{{').replace(/\}/g, rb + rb);
          var bib = '@article{' + (d.postId || 'post') + ',\n  author = {' + authors + '},\n  title = {' + titleBib + '},\n  journal = {' + (d.blogName || 'Genomics × AI Blog') + '},\n  year = {' + (d.year || '') + '},\n  url = {' + (d.url || '') + '}' + (d.doi ? ',\n  doi = {' + d.doi + '}' : '') + '\n' + rb;
          blob = new Blob([bib], { type: 'application/x-bibtex' });
          name = (d.postId || 'citation') + '.bib';
        } else if (format === 'ris') {
          var ris = 'TY  - BLOG\n';
          if (d.authors && d.authors.length) d.authors.forEach(function(a) { ris += 'AU  - ' + a + '\n'; });
          ris += 'TI  - ' + (d.title || '') + '\n';
          ris += 'JO  - ' + (d.blogName || 'Genomics × AI Blog') + '\n';
          ris += 'PY  - ' + (d.year || '') + '\n';
          if (d.url) ris += 'UR  - ' + d.url + '\n';
          if (d.doi) ris += 'DO  - ' + d.doi + '\n';
          ris += 'ER  - \n';
          blob = new Blob([ris], { type: 'application/x-research-info-systems' });
          name = (d.postId || 'citation') + '.ris';
        } else return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.rel = 'noopener';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });
  }
  document.querySelectorAll('.citation-box').forEach(initCitationBox);
})();
