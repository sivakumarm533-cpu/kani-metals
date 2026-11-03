import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api.js";
import Toast from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import LoadError from "../components/LoadError.jsx";
import { useToast } from "../hooks/useToast.js";
import { compressImage } from "../utils/image.js";
import { formatRupees, localDateInputValue as getTodayDate } from "../utils/format.js";

const itemCategories = ["Metal", "Plastic", "Paper", "Electronics"];
const emptyDealerForm = (type = "Regular Dealer") => ({ name: "", phone: "", location: "", type, image: "", cardColor: "#fff3e8", cardBackground: "" });
const emptyItemForm = () => ({ name: "", category: "", quantity: "", price: "", unit: "kg", image: "" });
const mapDealer = (dealer) => ({ ...dealer, id: dealer._id, type: dealer.category, image: dealer.profileImage });

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
  const [editingDealerId, setEditingDealerId] = useState(null);
  const [dealerForm, setDealerForm] = useState(() => emptyDealerForm());
  const [dealerCategories, setDealerCategories] = useState(["Regular Dealer", "Wholesale Dealer"]);
  const [newDealerCategory, setNewDealerCategory] = useState("");
  const [billDate, setBillDate] = useState(getTodayDate);
  const [billItems, setBillItems] = useState([]);
  const [billSaved, setBillSaved] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);

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
        if (requestedDealer) { setSelectedDealer(requestedDealer); setStep(2); }
      })
      .catch((error) => { if (active) setApiError(error.message); })
      .finally(() => { if (active) setDealersLoading(false); });
    return () => { active = false; };
  }, [requestedDealerId]);

  const searchText = search.trim().toLowerCase();
  const filteredDealers = dealerList.filter((dealer) =>
    `${dealer.name} ${dealer.phone} ${dealer.location}`.toLowerCase().includes(searchText)
  );

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
    };

    setBillItems((items) => editingItemId === null
      ? [...items, newItem]
      : items.map((item) => item.id === editingItemId ? newItem : item));
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    resetItemImageInput();
    setBillSaved(false);
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
    });
    setBillSaved(false);
    document.getElementById("itemName")?.focus();
  }

  function cancelItemEdit() {
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    resetItemImageInput();
  }

  async function saveBill() {
    if (billItems.length === 0 || isSaving) return;
    setApiError("");
    setIsSaving(true);
    try {
      await apiRequest("/bills", {
        method: "POST",
        body: JSON.stringify({
          dealer: selectedDealer.id,
          issuedDate: billDate,
          items: billItems.map(({ name, category, quantity, unit, price, image }) => ({ name, category, quantity, unit, price, image })),
        }),
      });
      setBillSaved(true);
      notify(`Bill saved for ${selectedDealer.name}.`);
      setStep(1);
      setBillItems([]);
      setEditingItemId(null);
      setItemForm(emptyItemForm());
      setBillDate(getTodayDate());
    } catch (error) {
      setApiError(error.message);
      setBillSaved(false);
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
        setSelectedDealer((dealer) => dealer?.id === editingDealerId ? updatedDealer : dealer);
      } else {
        setDealerList((items) => [updatedDealer, ...items]);
        setSelectedDealer(updatedDealer);
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
      await apiRequest(`/dealers/${dealerToDelete.id}`, { method: "DELETE" });
      setDealerList((dealers) => dealers.filter((dealer) => dealer.id !== dealerToDelete.id));
      setSelectedDealer((dealer) => dealer?.id === dealerToDelete.id ? null : dealer);
      if (editingDealerId === dealerToDelete.id) cancelDealerEdit();
      setDealerToDelete(null);
      notify("Dealer deleted successfully.", "danger", "bi-trash3-fill");
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
          <p className="page-description">Select a dealer, add the purchased items and save the bill.</p>
        </div>
      </header>

      {/* Step indicator */}
      <ol className="billing-steps" aria-label="Billing progress">
        <li className={`billing-step ${step === 1 ? "active" : "completed"}`} aria-current={step === 1 ? "step" : undefined}>
          <span>{step === 1 ? 1 : <i className="bi bi-check-lg" aria-hidden="true" />}</span>
          <div>
            <strong>Select Dealer</strong>
            <small>Choose customer</small>
          </div>
        </li>

        <li className={`step-line ${step === 2 ? "completed" : ""}`} aria-hidden="true" />

        <li className={`billing-step ${step === 2 ? "active" : ""}`} aria-current={step === 2 ? "step" : undefined}>
          <span>2</span>
          <div>
            <strong>Bill Details</strong>
            <small>Enter item details</small>
          </div>
        </li>
      </ol>

      <LoadError message={apiError} />

      {dealerToDelete && (
        <Modal role="alertdialog" busy={isDeletingDealer} onClose={() => setDealerToDelete(null)} labelledBy="dealer-delete-title" describedBy="dealer-delete-description">
          <div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div>
          <h2 id="dealer-delete-title">Delete dealer?</h2>
          <p id="dealer-delete-description">Are you sure you want to delete <strong>{dealerToDelete.name}</strong>? This action cannot be undone.</p>
          <div className="dealer-delete-actions">
            <button type="button" className="back-button" disabled={isDeletingDealer} onClick={() => setDealerToDelete(null)} data-autofocus>Cancel</button>
            <button type="button" className="confirm-delete-btn" disabled={isDeletingDealer} onClick={deleteDealer}>{isDeletingDealer ? "Deleting…" : "Delete dealer"}</button>
          </div>
        </Modal>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="boarder-box">
          <div className="dealer-header">
            <div>
              <h2 className="section-title">Select Dealer</h2>
              <p>Choose a dealer to create a new bill.</p>
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

          <div className="row g-3 mt-3">
            {dealersLoading && Array.from({ length: 3 }, (_, index) => (
              <div className="col-lg-4 col-md-6 col-12" key={index}><div className="skeleton skeleton-dealer-card" /></div>
            ))}

            {!dealersLoading && filteredDealers.map((dealer) => {
              const isSelected = selectedDealer?.id === dealer.id;
              return (
                <div className="col-xl-4 col-md-6 col-12" key={dealer.id}>
                  <div
                    className={`dealer-card ${isSelected ? "selected" : ""}`}
                    style={{
                      backgroundColor: dealer.cardColor || "var(--color-surface)",
                      backgroundImage: dealer.cardBackground
                        ? `linear-gradient(rgb(255 255 255 / 82%), rgb(255 255 255 / 82%)), url("${dealer.cardBackground}")`
                        : undefined,
                    }}
                    onClick={() => setSelectedDealer(dealer)}
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
                        <button type="button" className="delete-dealer-btn" aria-label={`Delete ${dealer.name}`} title="Delete dealer" onClick={(event) => { event.stopPropagation(); setDealerToDelete(dealer); }}>
                          <i className="bi bi-trash3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <h3 className="dealer-card-name">{dealer.name}</h3>
                    <span className="dealer-type">{dealer.type}</span>

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
                        setSelectedDealer(dealer);
                      }}
                    >
                      {isSelected ? <><i className="bi bi-check2" aria-hidden="true" /> Selected</> : "Select Dealer"}
                    </button>
                  </div>
                </div>
              );
            })}

            {!dealersLoading && !apiError && dealerList.length === 0 && (
              <div className="col-12"><div className="empty-state empty-state-panel"><i className="bi bi-person-plus" aria-hidden="true" /><strong>No dealers saved yet</strong><span>Add your first dealer to start creating bills.</span></div></div>
            )}
            {!dealersLoading && dealerList.length > 0 && filteredDealers.length === 0 && (
              <div className="col-12"><div className="empty-state"><i className="bi bi-search" aria-hidden="true" /><strong>No dealers match “{search}”</strong><button type="button" className="link-button" onClick={() => setSearch("")}>Clear search</button></div></div>
            )}
          </div>

          <div className="dealer-footer sticky-action-bar">
            <div>
              <small>Selected Dealer</small>
              <h6>{selectedDealer?.name || "No dealer selected"}</h6>
            </div>

            <button
              type="button"
              className="continue-btn"
              disabled={!selectedDealer}
              onClick={() => setStep(2)}
            >
              Continue <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 - BILL FORM */}
      {step === 2 && selectedDealer && (
        <div className="boarder-box">
          <div className="bill-header">
            <div>
              <h2 className="section-title">Enter Bill Details</h2>
              <p>Enter the items purchased by the selected dealer.</p>
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
            <input id="billDate" type="date" className="form-control" value={billDate} onChange={(event) => { setBillDate(event.target.value); setBillSaved(false); }} required />
          </div>

          <form onSubmit={addBillItem} className="bill-item-form">
            <div className="row g-4 mt-1">
              <div className="col-lg-7 col-12">
                <div className="row g-3">
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
                        {itemCategories.map((category) => <option key={category} value={category}>{category}</option>)}
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
                        <option value="kg">Kilogram (kg)</option>
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="ton">Ton</option>
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
                </div>
              </div>

              <div className="col-lg-5 col-12">
                <div className="image-upload-box h-100">
                  <label className="label-title" htmlFor="itemImage">
                    Item Image <small className="text-muted">Optional</small>
                  </label>
                  <input id="itemImage" type="file" accept="image/png,image/jpeg,image/webp" className="form-control" onChange={(event) => readImageFile(event, "image", setItemForm, { maxSize: 800 })} />
                  <div className="image-preview mt-3">
                    {itemForm.image ? <img src={itemForm.image} alt="Selected item preview" /> : <><i className="bi bi-image" aria-hidden="true" /><span>Image preview will appear here</span></>}
                  </div>
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
                    <tr className="table-empty-row"><td colSpan="7" className="bill-empty">Added items will appear here.</td></tr>
                  ) : billItems.map((item, index) => (
                    <tr key={item.id} className={editingItemId === item.id ? "is-editing" : ""}>
                      <td data-label="S.No.">{index + 1}</td>
                      <td data-label="Item" className="bill-item-name">{item.image && <img className="bill-item-thumb" src={item.image} alt="" />}{item.name}</td>
                      <td data-label="Category">{item.category}</td>
                      <td data-label="Quantity">{item.quantity} {item.unit}</td>
                      <td data-label="Price / unit">{formatRupees(item.price)}</td>
                      <td data-label="Amount">{formatRupees(item.quantity * item.price)}</td>
                      <td data-label="Actions">
                        <div className="bill-row-actions">
                          <button type="button" className="edit-bill-item" onClick={() => editBillItem(item)}>Edit</button>
                          <button type="button" className="remove-bill-item" aria-label={`Remove ${item.name}`} onClick={() => { setBillItems((items) => items.filter((entry) => entry.id !== item.id)); if (editingItemId === item.id) cancelItemEdit(); setBillSaved(false); }}>Remove</button>
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
              Back
            </button>
            <button type="button" className="continue-btn" disabled={billItems.length === 0 || isSaving} onClick={saveBill}>
              {isSaving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : `Save Bill · ${formatRupees(billTotal)}`}
            </button>
          </div>
          {billSaved && <p className="bill-success" role="status">Bill saved for {selectedDealer.name}.</p>}
        </div>
      )}
    </section>
  );
}

export default Itemsentry;
