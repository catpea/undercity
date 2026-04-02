// library/display/index.js
import { run as clearRun }    from './clear/library.js';
import { run as dividerRun }  from './divider/library.js';
import { run as markdownRun } from './markdown/library.js';
import { run as rawHtmlRun }  from './rawHtml/library.js';
import { run as safeHtmlRun } from './safeHtml/library.js';
import { run as textRun }     from './text/library.js';
import { run as valueRun }    from './value/library.js';

const categoryMeta = {
  id:          'display',
  name:        'Display',
  icon:        'type',
  color:       'var(--sol-cyan)',
  description: 'Append text, markdown, or HTML into the current card. Use Divider to open a new section.',
};

export const displayCategory = {
  name: `library/${categoryMeta.id}`,
  install(app) {
    app.registerCategory(categoryMeta, {
      'display.text':     { ...{"id":"display.text","icon":"body-text","color":"var(--sol-cyan)","label":"Print Text","desc":"Append plain text as a paragraph in the current card.","version":"2.0.0","params":[{"name":"text","label":"Text","type":"code","placeholder":"\"Hello \" + inventory.firstName"}]},     run: textRun },
      'display.markdown': { ...{"id":"display.markdown","icon":"markdown","color":"var(--sol-cyan)","label":"Print Markdown","desc":"Append rendered Markdown in the current card.","version":"2.0.0","params":[{"name":"content","label":"Markdown content","type":"textarea","placeholder":"**Bold** and _italic_"}]}, run: markdownRun },
      'display.safeHtml': { ...{"id":"display.safeHtml","icon":"shield-check","color":"var(--sol-cyan)","label":"Print Safe HTML","desc":"Append sanitized HTML in the current card — scripts and event attributes stripped.","version":"2.0.0","params":[{"name":"html","label":"HTML","type":"textarea","placeholder":"<b>Bold</b>"}]},          run: safeHtmlRun },
      'display.rawHtml':  { ...{"id":"display.rawHtml","icon":"code-slash","color":"var(--sol-cyan)","label":"Print Raw HTML","desc":"Append trusted HTML in the current card — no sanitization, use only with controlled content.","version":"2.0.0","params":[{"name":"html","label":"HTML","type":"textarea","placeholder":"<b>Trusted HTML</b>"}]}, run: rawHtmlRun },
      'display.value':    { ...{"id":"display.value","icon":"database","color":"var(--sol-cyan)","label":"Show Inventory Value","desc":"Append an inventory key's current value as plain text in the current card.","version":"2.0.0","params":[{"name":"key","label":"Inventory key","type":"text","placeholder":"firstName"}]},                    run: valueRun },
      'display.divider':  { ...{"id":"display.divider","icon":"layout-three-columns","color":"var(--sol-cyan)","label":"Divider","desc":"Close the current card section and open a new one.","version":"1.0.0","params":[]},                                                                                                                       run: dividerRun },
      'display.clear':    { ...{"id":"display.clear","icon":"eraser","color":"var(--sol-cyan)","label":"Clear Content","desc":"Remove all content cards from the page — use at the start of Enter to rebuild the form.","version":"2.0.0","params":[]},                                                                                             run: clearRun },
    });
  },
};
