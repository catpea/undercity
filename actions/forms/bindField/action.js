/**
 * form.bindField — runtime implementation
 *
 * Bidirectional live sync between a named DOM input and an inventory key.
 * After this step runs:
 *   - Field value is set from inventory immediately.
 *   - Typing in the field writes to inventory in real time.
 *   - External inventory changes (via Inventory.set) update the field.
 *
 * In runtime.js, this lives inside the Actions object:
 *
 *   bindField(fieldName, invKey) {
 *     const el = document.querySelector(`[name="${fieldName}"]`);
 *     if (!el) return;
 *     const v = Inventory.get(invKey);
 *     if (v !== null && v !== undefined) el.value = String(v);
 *     const onInput = () => Inventory.set(invKey, el.value);
 *     el.addEventListener('input', onInput);
 *     const offBus = Bus.on('inventory:changed', ({ key }) => {
 *       if ((key === invKey || key === '*') && el.ownerDocument.contains(el)) {
 *         const nv = String(Inventory.get(invKey) ?? '');
 *         if (el.value !== nv) el.value = nv;
 *       }
 *     });
 *     _pwRegisterBinding(() => { el.removeEventListener('input', onInput); offBus(); });
 *   },
 */
