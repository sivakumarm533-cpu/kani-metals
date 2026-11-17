import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api.js";
import Toast from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import LoadError from "../components/LoadError.jsx";
import BillShareModal from "../components/BillShareModal.jsx";
import { useToast } from "../hooks/useToast.js";
import { compressImage } from "../utils/image.js";
import { useProducts } from "../hooks/useProducts.js";
import { useAppSettings } from "../settings/appSettingsContext.js";
import { formatRupees, localDateInputValue as getTodayDate } from "../utils/format.js";
import { useAuth } from "../auth/authContextValue.js";
import { canUseItem, NAV_ITEMS } from "../config/navigation.js";

// Friendlier names for common units in the unit dropdown; any other unit shows as typed.
const unitLabels = { kg: "Kilogram (kg)", pcs: "Pieces (pcs)", ton: "Ton", g: "Gram (g)", litre: "Litre", metre: "Metre", bundle: "Bundle" };
const emptyDealerForm = (type = "Regular Dealer") => ({ name: "", phone: "", location: "", type, image: "", cardColor: "#fff3e8", cardBackground: "", active: true });
const emptyItemForm = () => ({ name: "", category: "", quantity: "", price: "", unit: "kg", image: "", note: "" });
// Dealers saved before the status existed count as active.
const mapDealer = (dealer) => ({ ...dealer, id: dealer._id, type: dealer.category, image: dealer.profileImage, active: dealer.active !== false });
const statusFilters = [["all", "All"], ["active", "Active"], ["inactive", "Inactive"]];
const flowSteps = [
  { label: "Choose dealer", hint: "Who are you buying from?" },
  { label: "Add items", hint: "What did you buy?" },
  { label: "Done", hint: "Send bill or record payment" },
];

function Itemsentry() {
  const [searchParams] = useSearchParams();
  const requestedDealerId = searchParams.get("dealer");
  const [step, setStep] = useState(1);
  const [dealerList, setDealerList] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [toast, notify] = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDealer, setIsSavingDealer] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [search, setSearch] = useState("");
  const [showDealerForm, setShowDealerForm] = useState(false);
  const [dealerToDelete, setDealerToDelete] = useState(null);
  const [isDeletingDealer, setIsDeletingDealer] = useState(false);
  // What deleting the dealer would also remove: { bills, payments, advancePaise, canDelete } or { error }.
  const [deleteSummary, setDeleteSummary] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingDealerId, setEditingDealerId] = useState(null);
  const { lists, features } = useAppSettings();
  const { user } = useAuth();
  const canRecordPayment = canUseItem(NAV_ITEMS.find((item) => item.key === "dealerPayments"), user, features);
  // Note and photo are optional, so they stay folded away unless needed.
  const [showItemExtras, setShowItemExtras] = useState(false);
  const [dealerForm, setDealerForm] = useState(() => emptyDealerForm(lists.dealerCategories[0]));
  // Categories found on saved dealers or added here; the main list comes from Settings → Dropdown lists.
  const [extraDealerCategories, setDealerCategories] = useState([]);
  const [newDealerCategory, setNewDealerCategory] = useState("");
  const [billDate, setBillDate] = useState(getTodayDate);
  const [billItems, setBillItems] = useState([]);
  const [lastSavedBill, setLastSavedBill] = useState(null);
  const [sharingBill, setSharingBill] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  // Inventory items can be picked to fill the line. Bills never change stock.
  const { products: inventoryItems } = useProducts();
  const [pickedItemId, setPickedItemId] = useState("");
  const pickedItem = inventoryItems.find((item) => item._id === pickedItemId) || null;
  const dealerCategories = [...new Set([...lists.dealerCategories, ...extraDealerCategories])];
  const categoryOptions = [...new Set([...lists.itemCategories, itemForm.category].filter(Boolean))];
  const unitOptions = lists.units.map((unit) => [unit, unitLabels[unit] || unit]);
  if (itemForm.unit && !unitOptions.some(([value]) => value === itemForm.unit)) unitOptions.push([itemForm.unit, itemForm.unit]);

  function pickInventoryItem(id) {
    setPickedItemId(id);
    const item = inventoryItems.find((entry) => entry._id === id);
    if (!item) return;
    setItemForm((current) => ({ ...current, name: item.name, category: item.category, unit: item.unit, price: item.price ? String(item.price) : current.price, image: item.image || "" }));
    resetItemImageInput();
    document.getElementById("quantity")?.focus();
  }

  useEffect(() => {
    let active = true;
    apiRequest("/dealers")
      .then((dealers) => {
        if (!active) return;
        const mappedDealers = dealers.map(mapDealer);
        setDealerList(mappedDealers);
        // Keep categories that exist on saved dealers available in the dropdown.
        setDealerCategories((current) => [...new Set([...current, ...mappedDealers.map((dealer) => dealer.type).filter(Boolean)])]);
        const requestedDealer = mappedDealers.find((dealer) => dealer.id === requestedDealerId);
        if (requestedDealer?.active) { setSelectedDealer(requestedDealer); setStep(2); }
      })
      .catch((error) => { if (active) setApiError(error.message); })
      .finally(() => { if (active) setDealersLoading(false); });
    return () => { active = false; };
  }, [requestedDealerId]);

  const searchText = search.trim().toLowerCase();
  const statusCounts = { all: dealerList.length, active: dealerList.filter((dealer) => dealer.active).length, inactive: dealerList.filter((dealer) => !dealer.active).length };
  const filteredDealers = dealerList.filter((dealer) =>
    (statusFilter === "all" || (statusFilter === "active") === dealer.active) &&
    `${dealer.name} ${dealer.phone} ${dealer.location}`.toLowerCase().includes(searchText)
  );

  function selectDealer(dealer) {
    if (!dealer.active) { notify(`${dealer.name} is inactive. Edit the dealer and switch them to Active to create a bill.`, "info", "bi-pause-circle"); return; }
    setSelectedDealer(dealer);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function askDeleteDealer(dealer) {
    setDealerToDelete(dealer);
    setDeleteSummary(null);
    setDeleteConfirmText("");
    apiRequest(`/dealers/${dealer.id}/delete-summary`)
      .then(setDeleteSummary)
      .catch((error) => setDeleteSummary({ error: error.message }));
  }

  const billTotal = billItems.reduce((total, item) => total + item.quantity * item.price, 0);

  function resetItemImageInput() {
    const imageInput = document.getElementById("itemImage");
    if (imageInput) imageInput.value = "";
  }

  function addBillItem(event) {
    event.preventDefault();
    const newItem = {
      ...itemForm,
      id: editingItemId ?? crypto.randomUUID(),
      quantity: Number(itemForm.quantity),
      price: Number(itemForm.price),
      note: itemForm.note.trim(),
    };

    setBillItems((items) => editingItemId === null
      ? [...items, newItem]
      : items.map((item) => item.id === editingItemId ? newItem : item));
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    setPickedItemId("");
    setShowItemExtras(false);
    resetItemImageInput();
    document.getElementById("itemName")?.focus();
  }

  function editBillItem(item) {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      price: String(item.price),
      unit: item.unit,
      image: item.image || "",
      note: item.note || "",
    });
    setShowItemExtras(Boolean(item.note || item.image));
    document.getElementById("itemName")?.focus();
  }

  function cancelItemEdit() {
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    setPickedItemId("");
    setShowItemExtras(false);
    resetItemImageInput();
  }

  async function saveBill() {
    if (billItems.length === 0 || isSaving) return;
    setApiError("");
    setIsSaving(true);
    try {
      const savedBill = await apiRequest("/bills", {
        method: "POST",
        body: JSON.stringify({
          dealer: selectedDealer.id,
          issuedDate: billDate,
          items: billItems.map(({ name, category, quantity, unit, price, image, note }) => ({ name, category, quantity, unit, price, image, note })),
        }),
      });
      setLastSavedBill({ id: savedBill._id, dealerId: selectedDealer.id, dealerName: selectedDealer.name, total: savedBill.total, itemCount: billItems.length, issuedDate: savedBill.issuedDate || billDate });
      notify(`Bill saved for ${selectedDealer.name}.`);
      setStep(3);
      setBillItems([]);
      setEditingItemId(null);
      setItemForm(emptyItemForm());
      setPickedItemId("");
      setShowItemExtras(false);
      setBillDate(getTodayDate());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function addDealer(event) {
    event.preventDefault();
    if (isSavingDealer) return;
    setApiError("");
    setIsSavingDealer(true);
    const payload = {
      name: dealerForm.name,
      phone: dealerForm.phone,
      location: dealerForm.location,
      category: dealerForm.type,
      profileImage: dealerForm.image,
      cardColor: dealerForm.cardColor,
      cardBackground: dealerForm.cardBackground,
      active: dealerForm.active,
    };

    try {
      const wasEditing = editingDealerId !== null;
      const saved = await apiRequest(
        wasEditing ? `/dealers/${editingDealerId}` : "/dealers",
        { method: wasEditing ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const updatedDealer = mapDealer(saved);
      if (wasEditing) {
        setDealerList((items) => items.map((dealer) => dealer.id === editingDealerId ? updatedDealer : dealer));
        // An inactive dealer cannot stay selected for a new bill.
        setSelectedDealer((dealer) => dealer?.id === editingDealerId ? (updatedDealer.active ? updatedDealer : null) : dealer);
      } else {
        setDealerList((items) => [updatedDealer, ...items]);
        if (updatedDealer.active) setSelectedDealer(updatedDealer);
      }
      setEditingDealerId(null);
      setDealerForm(emptyDealerForm(dealerCategories[0]));
      setShowDealerForm(false);
      notify(wasEditing ? "Dealer updated successfully." : "Dealer added successfully.", wasEditing ? "info" : "success");
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsSavingDealer(false);
    }
  }

  function editDealer(dealer, event) {
    event.stopPropagation();
    setEditingDealerId(dealer.id);
    setDealerForm({
      name: dealer.name,
      phone: dealer.phone,
      location: dealer.location,
      type: dealer.type,
      image: dealer.image || "",
      cardColor: dealer.cardColor || "#fff3e8",
      cardBackground: dealer.cardBackground || "",
      active: dealer.active,
    });
    setShowDealerForm(true);
    window.requestAnimationFrame(() => document.getElementById("dealer-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function cancelDealerEdit() {
    setShowDealerForm(false);
    setEditingDealerId(null);
    setDealerForm(emptyDealerForm(dealerCategories[0]));
  }

  async function deleteDealer() {
    if (!dealerToDelete) return;
    setApiError("");
    setIsDeletingDealer(true);
    try {
      const result = await apiRequest(`/dealers/${dealerToDelete.id}`, { method: "DELETE" });
      setDealerList((dealers) => dealers.filter((dealer) => dealer.id !== dealerToDelete.id));
      setSelectedDealer((dealer) => dealer?.id === dealerToDelete.id ? null : dealer);
      if (editingDealerId === dealerToDelete.id) cancelDealerEdit();
      setDealerToDelete(null);
      notify(result?.message || "Dealer deleted successfully.", "danger", "bi-trash3-fill");
    } catch (error) {
      setDealerToDelete(null);
      setApiError(error.message);
    } finally {
      setIsDeletingDealer(false);
    }
  }

  /** Reads, resizes and compresses an image before keeping it in the form. */
  async function readImageFile(event, field, setForm, options) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      setForm((current) => ({ ...current, [field]: "" }));
      return;
    }
    try {
      const dataUrl = await compressImage(file, options);
      setForm((current) => ({ ...current, [field]: dataUrl }));
    } catch (error) {
      input.value = "";
      setApiError(error.message);
    }
  }

  /** After a bill is saved: start another bill, for the same dealer or a different one. */
  function startNewBill(sameDealer) {
    setLastSavedBill(null);
    if (sameDealer && selectedDealer) setStep(2);
    else { setSelectedDealer(null); setStep(1); }
  }

  function addDealerCategory() {
    const category = newDealerCategory.trim();
    if (!category) return;
    if (!dealerCategories.some((item) => item.toLowerCase() === category.toLowerCase())) {
      setDealerCategories((categories) => [...categories, category]);
    }
    setDealerForm((current) => ({ ...current, type: category }));
    setNewDealerCategory("");
  }

  return (
    <section className="page-container items-entery">
      <Toast toast={toast} />

      <header className="page-header">
        <div>
          <p className="eyebrow">BILLING</p>
          <h1 className="page-title">Item entry</h1>
          <p className="page-description">Three simple steps: choose the dealer, add what you bought, save the bill.</p>
        </div>
      </header>

      <ol className="billing-steps" aria-label="Billing progress">
        {flowSteps.map((entry, index) => {
          const number = index + 1;
          const state = step === number ? "active" : step > number ? "completed" : "";
          return [
            index > 0 && <li key={`line-${number}`} className={`step-line ${step >= number ? "completed" : ""}`} aria-hidden="true" />,
            <li key={entry.label} className={`billing-step ${state}`} aria-current={step === number ? "step" : undefined}>
              <span>{step > number ? <i className="bi bi-check-lg" aria-hidden="true" /> : number}</span>
              <div>
                <strong>{entry.label}</strong>
                <small>{number === 1 && selectedDealer && step > 1 ? selectedDealer.name : entry.hint}</small>
              </div>
            </li>,
          ];
        })}
      </ol>

      <LoadError message={apiError} />

      {sharingBill && <BillShareModal dealerId={sharingBill.dealerId} billId={sharingBill.id} onClose={() => setSharingBill(null)} />}

      {dealerToDelete && (() => {
        const summary = deleteSummary;
        const hasHistory = Boolean(summary && !summary.error && (summary.bills || summary.payments));
        const needsTyping = hasHistory;
        const typedOk = !needsTyping || deleteConfirmText.trim().toLowerCase() === dealerToDelete.name.trim().toLowerCase();
        const blocked = !summary || summary.error || summary.canDelete === false;
        return (
          <Modal role="alertdialog" busy={isDeletingDealer} onClose={() => setDealerToDelete(null)} labelledBy="dealer-delete-title" describedBy="dealer-delete-description">
            <div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div>
            <h2 id="dealer-delete-title">Delete {dealerToDelete.name}?</h2>
            {!summary && <p id="dealer-delete-description">Checking this dealer's bills and payments…</p>}
            {summary?.error && <p id="dealer-delete-description" className="api-error" role="alert">{summary.error}</p>}
            {summary && !summary.error && !hasHistory && <p id="dealer-delete-description">This dealer has no bills or payments. This action cannot be undone.</p>}
            {hasHistory && <>
              <p id="dealer-delete-description">This permanently deletes the dealer <strong>and all of their history</strong>:</p>
              <ul className="dealer-delete-impact">
                <li><i className="bi bi-receipt" aria-hidden="true" /> <strong>{summary.bills}</strong> {summary.bills === 1 ? "bill" : "bills"}</li>
                <li><i className="bi bi-wallet2" aria-hidden="true" /> <strong>{summary.payments}</strong> {summary.payments === 1 ? "payment" : "payments"}</li>
                {summary.advancePaise > 0 && <li><i className="bi bi-piggy-bank" aria-hidden="true" /> {formatRupees(summary.advancePaise / 100)} advance balance</li>}
              </ul>
              <p className="dealer-delete-tip">To keep the history, edit the dealer and switch them to <strong>Inactive</strong> instead.</p>
              {summary.canDelete === false
                ? <p className="api-error" role="alert">Only an administrator or sub-admin can delete a dealer with history.</p>
                : <label className="dealer-delete-confirm">Type <strong>{dealerToDelete.name}</strong> to confirm
                    <input className="form-control" value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} autoComplete="off" disabled={isDeletingDealer} />
                  </label>}
            </>}
            <div className="dealer-delete-actions">
              <button type="button" className="back-button" disabled={isDeletingDealer} onClick={() => setDealerToDelete(null)} data-autofocus>Cancel</button>
              <button type="button" className="confirm-delete-btn" disabled={isDeletingDealer || blocked || !typedOk} onClick={deleteDealer}>{isDeletingDealer ? "Deleting…" : hasHistory ? "Delete dealer and history" : "Delete dealer"}</button>
            </div>
          </Modal>
        );
      })()}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="boarder-box">
          <div className="dealer-header">
            <div>
              <h2 className="section-title">Step 1 · Choose a dealer</h2>
              <p>Tap a dealer to start their bill. New dealer? Tap <strong>Add Dealer</strong> first.</p>
            </div>

            <button type="button" className="add-dealer-btn" aria-expanded={showDealerForm} aria-controls="dealer-form" onClick={() => (showDealerForm ? cancelDealerEdit() : setShowDealerForm(true))}>
              <i className={`bi ${showDealerForm ? "bi-x-lg" : "bi-plus-lg"}`} aria-hidden="true"></i> {showDealerForm ? "Close form" : "Add Dealer"}
            </button>
          </div>

          {showDealerForm && (
            <form className="dealer-form" id="dealer-form" onSubmit={addDealer} aria-busy={isSavingDealer}>
              <h3>{editingDealerId !== null ? "Edit dealer" : "Add a dealer"}</h3>
              <div className="dealer-form-grid">
                <label>Dealer name<input className="form-control" value={dealerForm.name} maxLength="120" onChange={(event) => setDealerForm({ ...dealerForm, name: event.target.value })} required /></label>
                <label>Phone number<input className="form-control" type="tel" inputMode="tel" maxLength="30" value={dealerForm.phone} onChange={(event) => setDealerForm({ ...dealerForm, phone: event.target.value })} required /></label>
                <label>Location<input className="form-control" value={dealerForm.location} maxLength="200" onChange={(event) => setDealerForm({ ...dealerForm, location: event.target.value })} required /></label>
                <label>Dealer category<select className="form-select" value={dealerForm.type} onChange={(event) => setDealerForm({ ...dealerForm, type: event.target.value })}>{dealerCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>New dealer category<div className="category-add-control"><input className="form-control" value={newDealerCategory} maxLength="60" onChange={(event) => setNewDealerCategory(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDealerCategory(); } }} placeholder="Add a category" /><button type="button" className="back-button" onClick={addDealerCategory}>Add</button></div></label>
                <label>Profile photo (optional)<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImageFile(event, "image", setDealerForm, { maxSize: 400 })} /></label>
                <label>Card background color<input className="form-control form-control-color" type="color" value={dealerForm.cardColor} onChange={(event) => setDealerForm({ ...dealerForm, cardColor: event.target.value })} /></label>
                <label>Card background image (optional)<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImageFile(event, "cardBackground", setDealerForm, { maxSize: 900, quality: 0.75 })} /></label>
              </div>
              <label className={`dealer-status-field${dealerForm.active ? "" : " is-off"}`}>
                <span className={`dealer-status-icon${dealerForm.active ? " is-active" : ""}`} aria-hidden="true"><i className={`bi ${dealerForm.active ? "bi-check-circle-fill" : "bi-pause-circle-fill"}`} /></span>
                <span className="dealer-status-text"><strong>Dealer status: <span className={dealerForm.active ? "dealer-status-on" : "dealer-status-off"}>{dealerForm.active ? "Active" : "Inactive"}</span></strong><small>{dealerForm.active ? "Can get new bills." : "Kept with all history, but no new bills can be created."}</small></span>
                <span className={`feature-switch dealer-status-switch${dealerForm.active ? " is-on" : ""}`}>
                  <input type="checkbox" role="switch" checked={dealerForm.active} onChange={(event) => setDealerForm({ ...dealerForm, active: event.target.checked })} aria-label="Dealer is active" />
                  <span className="feature-switch-track" aria-hidden="true"><span /></span>
                </span>
              </label>
              {(dealerForm.image || dealerForm.cardBackground) && <div className="dealer-image-previews">
                {dealerForm.image && <span><img className="dealer-photo-preview" src={dealerForm.image} alt="Dealer profile preview" /><button type="button" className="link-button" onClick={() => setDealerForm((current) => ({ ...current, image: "" }))}>Remove photo</button></span>}
                {dealerForm.cardBackground && <span><img className="dealer-photo-preview dealer-background-preview" src={dealerForm.cardBackground} alt="Card background preview" /><button type="button" className="link-button" onClick={() => setDealerForm((current) => ({ ...current, cardBackground: "" }))}>Remove background</button></span>}
              </div>}
              <div className="dealer-form-actions">
                <button type="button" className="back-button" onClick={cancelDealerEdit}>Cancel</button>
                <button type="submit" className="continue-btn" disabled={isSavingDealer}>{isSavingDealer ? "Saving…" : editingDealerId !== null ? "Update dealer" : "Save dealer"}</button>
              </div>
            </form>
          )}

          <label className="dealer-search">
            <i className="bi bi-search" aria-hidden="true"></i>
            <span className="visually-hidden">Search dealers</span>
            <input
              type="search"
              placeholder="Search by dealer name, phone or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="dealer-status-filter" role="radiogroup" aria-label="Show dealers">
            {statusFilters.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={statusFilter === id} className={`dealer-pick-chip${statusFilter === id ? " is-active" : ""}`} onClick={() => setStatusFilter(id)}>
                {label} <span className="dealer-status-count">{statusCounts[id]}</span>
              </button>
            ))}
          </div>

          <div className="row g-3 mt-3">
            {dealersLoading && Array.from({ length: 3 }, (_, index) => (
              <div className="col-lg-4 col-md-6 col-12" key={index}><div className="skeleton skeleton-dealer-card" /></div>
            ))}

            {!dealersLoading && filteredDealers.map((dealer) => {
              const isSelected = selectedDealer?.id === dealer.id;
              return (
                <div className="col-xl-4 col-md-6 col-12" key={dealer.id}>
                  <div
                    className={`dealer-card ${isSelected ? "selected" : ""}${dealer.active ? "" : " is-inactive"}`}
                    style={{
                      backgroundColor: dealer.cardColor || "var(--color-surface)",
                      backgroundImage: dealer.cardBackground
                        ? `linear-gradient(rgb(255 255 255 / 82%), rgb(255 255 255 / 82%)), url("${dealer.cardBackground}")`
                        : undefined,
                    }}
                    onClick={() => selectDealer(dealer)}
                  >
                    <div className="dealer-card-top">
                      <div className="dealer-avatar">
                        {dealer.image
                          ? <img src={dealer.image} alt="" loading="lazy" />
                          : dealer.name.substring(0, 2).toUpperCase()}
                      </div>

                      {isSelected && (
                        <i className="bi bi-check-circle-fill selected-icon" aria-hidden="true" />
                      )}
                      <div className="dealer-card-actions">
                        <Link className="view-dealer-bills-btn" to={`/dealers/${dealer.id}/bills`} aria-label={`View ${dealer.name} bill history`} title="View bill history" onClick={(event) => event.stopPropagation()}>
                          <i className="bi bi-clock-history" aria-hidden="true" />
                        </Link>
                        <button type="button" className="edit-dealer-btn" aria-label={`Edit ${dealer.name}`} title="Edit dealer" onClick={(event) => editDealer(dealer, event)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button type="button" className="delete-dealer-btn" aria-label={`Delete ${dealer.name}`} title="Delete dealer" onClick={(event) => { event.stopPropagation(); askDeleteDealer(dealer); }}>
                          <i className="bi bi-trash3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <h3 className="dealer-card-name">{dealer.name}</h3>
                    <span className="dealer-card-tags">
                      <span className="dealer-type">{dealer.type}</span>
                      <span className={`dealer-status-badge${dealer.active ? " is-active" : ""}`}><i className={`bi ${dealer.active ? "bi-check-circle-fill" : "bi-pause-circle-fill"}`} aria-hidden="true" /> {dealer.active ? "Active" : "Inactive"}</span>
                    </span>

                    <div className="dealer-info">
                      <p><i className="bi bi-telephone" aria-hidden="true" /> {dealer.phone}</p>
                      <p><i className="bi bi-geo-alt" aria-hidden="true" /> {dealer.location || "—"}</p>
                    </div>

                    <button
                      type="button"
                      className={`select-dealer-btn ${isSelected ? "active" : ""}`}
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDealer(dealer);
                      }}
                    >
                      {!dealer.active ? <><i className="bi bi-pause-circle" aria-hidden="true" /> Inactive</> : <>Start bill <i className="bi bi-arrow-right" aria-hidden="true" /></>}
                    </button>
                  </div>
                </div>
              );
            })}

            {!dealersLoading && !apiError && dealerList.length === 0 && (
              <div className="col-12"><div className="empty-state empty-state-panel"><i className="bi bi-person-plus" aria-hidden="true" /><strong>No dealers saved yet</strong><span>Add your first dealer to start creating bills.</span></div></div>
            )}
            {!dealersLoading && dealerList.length > 0 && filteredDealers.length === 0 && (
              <div className="col-12"><div className="empty-state"><i className="bi bi-search" aria-hidden="true" /><strong>{search ? `No ${statusFilter === "all" ? "" : `${statusFilter} `}dealers match “${search}”` : `No ${statusFilter} dealers`}</strong><button type="button" className="link-button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Show all dealers</button></div></div>
            )}
          </div>

        </div>
      )}

      {/* STEP 2 - BILL FORM */}
      {step === 2 && selectedDealer && (
        <div className="boarder-box">
          <div className="bill-header">
            <div>
              <h2 className="section-title">Step 2 · Add items</h2>
              <p>Fill in one item and tap <strong>Add item</strong>. Repeat for every item, then tap <strong>Save Bill</strong>.</p>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => setStep(1)}
            >
              <i className="bi bi-arrow-left" aria-hidden="true" /> Change Dealer
            </button>
          </div>

          <div className="selected-dealer-info">
            <i className="bi bi-person-circle" aria-hidden="true" />
            <div>
              <small>Selected Dealer</small>
              <strong>{selectedDealer.name}</strong>
              <span>{selectedDealer.phone}{selectedDealer.location ? ` · ${selectedDealer.location}` : ""}</span>
            </div>
          </div>

          <div className="bill-date-field">
            <label className="label-title" htmlFor="billDate">Bill issued date</label>
            <input id="billDate" type="date" className="form-control" value={billDate} onChange={(event) => { setBillDate(event.target.value); }} required />
          </div>

          <form onSubmit={addBillItem} className="bill-item-form">
            <div className="row g-4 mt-1">
              <div className="col-12"><h3 className="bill-form-subtitle">{editingItemId !== null ? "Edit item" : `Item ${billItems.length + 1}`}</h3></div>
              <div className="col-12">
                <div className="row g-3">
                  {inventoryItems.length > 0 && (
                    <div className="col-12">
                      <div className="form-group inventory-pick">
                        <label className="label-title" htmlFor="inventoryPick"><i className="bi bi-boxes" aria-hidden="true" /> Pick from inventory <small className="text-muted">Optional</small></label>
                        <select id="inventoryPick" className="form-select" value={pickedItemId} onChange={(event) => pickInventoryItem(event.target.value)}>
                          <option value="">Type a new item, or choose one…</option>
                          {inventoryItems.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.unit}){item.price ? ` · ${formatRupees(item.price)}` : ""} · stock {item.quantity}</option>)}
                        </select>
                        {pickedItem && <small className="inventory-pick-note">Filled from inventory. In stock: <b>{pickedItem.quantity} {pickedItem.unit}</b>. Saving the bill does not change stock.</small>}
                      </div>
                    </div>
                  )}
                  <div className="col-md-6 col-12">
                    <div className="form-group">
                      <label className="label-title" htmlFor="itemName">Item Name</label>
                      <input id="itemName" className="form-control" placeholder="Enter item name" maxLength="120" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} required />
                    </div>
                  </div>

                  <div className="col-md-6 col-12">
                    <div className="form-group">
                      <label className="label-title" htmlFor="category">Category</label>
                      <select id="category" className="form-select" value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} required>
                        <option value="" disabled>Select category</option>
                        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-4 col-6">
                    <div className="form-group">
                      <label className="label-title" htmlFor="quantity">Quantity</label>
                      <input id="quantity" type="number" inputMode="decimal" min="0.01" step="any" className="form-control" placeholder="0" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} required />
                    </div>
                  </div>

                  <div className="col-md-4 col-6">
                    <div className="form-group">
                      <label className="label-title" htmlFor="unit">Unit</label>
                      <select id="unit" className="form-select" value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })}>
                        {unitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-4 col-12">
                    <div className="form-group">
                      <label className="label-title" htmlFor="price">Price per unit (₹)</label>
                      <input id="price" type="number" inputMode="decimal" min="0" step="0.01" className="form-control" placeholder="0.00" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })} required />
                    </div>
                  </div>

                  {itemForm.quantity && itemForm.price && <div className="col-12"><p className="item-line-total">Line amount: <strong>{formatRupees(Number(itemForm.quantity) * Number(itemForm.price))}</strong></p></div>}
                  <div className="col-12">
                    <button type="button" className="link-button item-extras-toggle" aria-expanded={showItemExtras} aria-controls="item-extras" onClick={() => setShowItemExtras((open) => !open)}>
                      <i className={`bi ${showItemExtras ? "bi-dash-circle" : "bi-plus-circle"}`} aria-hidden="true" /> {showItemExtras ? "Hide note and photo" : "Add a note or photo (optional)"}
                    </button>
                  </div>
                  {showItemExtras && <div className="col-12" id="item-extras"><div className="row g-3">
                  <div className="col-md-7 col-12">
                    <div className="form-group">
                      <label className="label-title" htmlFor="itemNote">Note <small className="text-muted">Optional · printed under the item on the bill</small></label>
                      <input id="itemNote" className="form-control" maxLength="200" placeholder="e.g. 1210 - 10 = 1200 (10 kg was waste material)" value={itemForm.note} onChange={(event) => setItemForm({ ...itemForm, note: event.target.value })} />
                    </div>
                  </div>
                  <div className="col-md-5 col-12">
                    <div className="image-upload-box">
                      <label className="label-title" htmlFor="itemImage">
                        Item Image <small className="text-muted">Optional</small>
                      </label>
                      <input id="itemImage" type="file" accept="image/png,image/jpeg,image/webp" className="form-control" onChange={(event) => readImageFile(event, "image", setItemForm, { maxSize: 800 })} />
                      <div className="image-preview mt-3">
                        {itemForm.image ? <img src={itemForm.image} alt="Selected item preview" /> : <><i className="bi bi-image" aria-hidden="true" /><span>Image preview will appear here</span></>}
                      </div>
                    </div>
                  </div>
                  </div></div>}
                </div>
              </div>
            </div>

            <div className="bill-actions bill-actions-inline">
              {editingItemId !== null && (
                <button type="button" className="back-button" onClick={cancelItemEdit}>Cancel edit</button>
              )}
              <button type="submit" className="continue-btn">
                <i className={`bi ${editingItemId !== null ? "bi-check-lg" : "bi-plus-lg"}`} aria-hidden="true" />
                {editingItemId !== null ? "Update item" : "Add item"}
              </button>
            </div>
          </form>

          <section className="bill-preview" aria-label="Bill preview">
            <div className="bill-preview-heading">
              <div>
                <h3>Bill items</h3>
                <p>{billItems.length} {billItems.length === 1 ? "item" : "items"} added</p>
              </div>
              <strong>Total: {formatRupees(billTotal)}</strong>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0 responsive-card-table">
                <thead>
                  <tr><th>S.No.</th><th>Item</th><th>Category</th><th>Quantity</th><th>Price / unit</th><th>Amount</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {billItems.length === 0 ? (
                    <tr className="table-empty-row"><td colSpan="7" className="bill-empty">No items yet. Fill in the form above and tap “Add item”.</td></tr>
                  ) : billItems.map((item, index) => (
                    <tr key={item.id} className={editingItemId === item.id ? "is-editing" : ""}>
                      <td data-label="S.No.">{index + 1}</td>
                      <td data-label="Item" className="bill-item-name">{item.image && <img className="bill-item-thumb" src={item.image} alt="" />}<span>{item.name}{item.note && <small className="bill-item-note">{item.note}</small>}</span></td>
                      <td data-label="Category">{item.category}</td>
                      <td data-label="Quantity">{item.quantity} {item.unit}</td>
                      <td data-label="Price / unit">{formatRupees(item.price)}</td>
                      <td data-label="Amount">{formatRupees(item.quantity * item.price)}</td>
                      <td data-label="Actions">
                        <div className="bill-row-actions">
                          <button type="button" className="edit-bill-item" onClick={() => editBillItem(item)}>Edit</button>
                          <button type="button" className="remove-bill-item" aria-label={`Remove ${item.name}`} onClick={() => { setBillItems((items) => items.filter((entry) => entry.id !== item.id)); if (editingItemId === item.id) cancelItemEdit(); }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="bill-actions sticky-action-bar">
            <button type="button" className="back-button" onClick={() => setStep(1)}>
              <i className="bi bi-arrow-left" aria-hidden="true" /> Back
            </button>
            <button type="button" className="continue-btn" disabled={billItems.length === 0 || isSaving} onClick={saveBill}>
              {isSaving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : `Save Bill · ${formatRupees(billTotal)}`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 - DONE */}
      {step === 3 && lastSavedBill && (
        <div className="boarder-box bill-done">
          <span className="bill-done-icon" aria-hidden="true"><i className="bi bi-check-circle-fill" /></span>
          <h2 className="section-title">Bill saved</h2>
          <p className="bill-done-summary">
            <strong>{lastSavedBill.dealerName}</strong> · {lastSavedBill.itemCount} {lastSavedBill.itemCount === 1 ? "item" : "items"} · {new Date(lastSavedBill.issuedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="bill-done-total">{formatRupees(lastSavedBill.total)}</p>
          <p className="bill-done-question">What would you like to do next?</p>
          <div className="bill-done-actions">
            <button type="button" className="bill-done-action is-whatsapp" onClick={() => setSharingBill(lastSavedBill)}>
              <i className="bi bi-whatsapp" aria-hidden="true" /><span><strong>Send bill on WhatsApp</strong><small>Share it with the dealer</small></span>
            </button>
            {canRecordPayment && (
              <Link className="bill-done-action" to={`/dealer-payments/${lastSavedBill.dealerId}?bill=${lastSavedBill.id}&record=1`}>
                <i className="bi bi-wallet2" aria-hidden="true" /><span><strong>Record payment</strong><small>Money paid for this bill</small></span>
              </Link>
            )}
            <button type="button" className="bill-done-action" onClick={() => startNewBill(true)}>
              <i className="bi bi-plus-circle" aria-hidden="true" /><span><strong>Another bill for {lastSavedBill.dealerName}</strong><small>Same dealer, new bill</small></span>
            </button>
            <button type="button" className="bill-done-action" onClick={() => startNewBill(false)}>
              <i className="bi bi-people" aria-hidden="true" /><span><strong>Bill for another dealer</strong><small>Go back to the dealer list</small></span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Itemsentry;
