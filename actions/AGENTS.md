# Actions — Plugin Author Guide

Each action lives in its own directory:
  actions/<category>/<actionName>/
    action.json      — IDE metadata (label, desc, params)
    action.js        — Runtime implementation documentation
    action.test.js   — Unit tests

The category index plugin (actions/<category>/index.js) is the browser-side
ES module that registers the category with the IDE via App.use().

## action.json schema

```json
{
  "id":            "category.actionName",
  "category":      "category",
  "categoryLabel": "Human Label",
  "icon":          "bootstrap-icon-name",
  "color":         "var(--sol-yellow)",
  "label":         "Action Label",
  "desc":          "Clear description stating WHEN it runs and WHERE results go.",
  "version":       "1.0.0",
  "params": [
    { "name": "fieldName", "label": "Human Label", "type": "text|code|inventory-key|select|boolean|number|textarea|room" }
  ]
}
```

## Creating a new category plugin

1. Create `actions/<category>/index.js` exporting `<Category>Plugin`
2. Import it in `actions/index.js` and add to `ActionsPlugin.install()`
3. Each action that differs from the server-read action.json should be defined here

## Naming rules

- Category IDs: lowercase, e.g. `forms`, `user`, `nav`
- Action IDs: `<category>.<camelCaseName>`, e.g. `form.bindField`
- Directory names must match action camelCase: `bindField/`
- The category/action path in the directory MUST match the id in action.json
