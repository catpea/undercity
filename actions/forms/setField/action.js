/**
 * form.setField — runtime implementation
 *
 * Sets a form input's value. When called via a step with an inventory-key param,
 * runPayload resolves { $$inv: "key" } → Inventory.get("key") before passing here.
 * So this function always receives the resolved value.
 *
 * In runtime.js, this lives inside the Actions object:
 *
 *   setField(name, val) {
 *     const el = document.querySelector(`[name="${name}"]`);
 *     if (el) el.value = val ?? '';
 *   },
 */
