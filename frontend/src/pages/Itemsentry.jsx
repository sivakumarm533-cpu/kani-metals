
import { useEffect, useState } from "react";
import "./pages.css";
import { apiRequest } from "../services/api.js";
import { Link, useSearchParams } from "react-router-dom";

function getTodayDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function Itemsentry() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [dealerList, setDealerList] = useState([]);
  const [apiError, setApiError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [search, setSearch] = useState("");
  const [showDealerForm, setShowDealerForm] = useState(false);
  const [dealerToDelete, setDealerToDelete] = useState(null);
  const [isDeletingDealer, setIsDeletingDealer] = useState(false);
  const [editingDealerId, setEditingDealerId] = useState(null);
  const [dealerForm, setDealerForm] = useState({ name: "", phone: "", location: "", type: "Regular Dealer", image: "", cardColor: "#fff3e8", cardBackground: "" });
  const [dealerCategories, setDealerCategories] = useState(["Regular Dealer", "Wholesale Dealer"]);
  const [newDealerCategory, setNewDealerCategory] = useState("");
  const itemCategories = ["Metal", "Plastic", "Paper", "Electronics"];
  const [billDate, setBillDate] = useState(getTodayDate);
  const [billItems, setBillItems] = useState([]);
  const [billSaved, setBillSaved] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    category: "",
    quantity: "",
    price: "",
    unit: "kg",
  });

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    apiRequest("/dealers")
      .then((dealers) => {
        const mappedDealers = dealers.map((dealer) => ({
        ...dealer,
        id: dealer._id,
        type: dealer.category,
        image: dealer.profileImage,
        }));
        setDealerList(mappedDealers);
        const requestedDealer = mappedDealers.find((dealer) => dealer.id === searchParams.get("dealer"));
        if (requestedDealer) { setSelectedDealer(requestedDealer); setStep(2); }
      })
      .catch((error) => setApiError(error.message));
  }, []);

  const filteredDealers = dealerList.filter((dealer) =>
    dealer.name.toLowerCase().includes(search.toLowerCase())
  );

  const billTotal = billItems.reduce((total, item) => total + item.quantity * item.price, 0);

  function addBillItem(event) {
    event.preventDefault();
    const newItem = {
      ...itemForm,
      id: editingItemId ?? Date.now(),
      quantity: Number(itemForm.quantity),
      price: Number(itemForm.price),
    };

    setBillItems((items) => editingItemId === null
      ? [...items, newItem]
      : items.map((item) => item.id === editingItemId ? newItem : item));
    setEditingItemId(null);
    setItemForm({ name: "", category: "", quantity: "", price: "", unit: "kg", image: "" });
    const imageInput = document.getElementById("itemImage");
    if (imageInput) imageInput.value = "";
    setBillSaved(false);
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
    setItemForm({ name: "", category: "", quantity: "", price: "", unit: "kg", image: "" });
    const imageInput = document.getElementById("itemImage");
    if (imageInput) imageInput.value = "";
  }

  async function saveBill() {
    if (billItems.length === 0) return;
    setApiError("");
    setIsSaving(true);
    try {
      await apiRequest("/bills", {
        method: "POST",
        body: JSON.stringify({
          dealer: selectedDealer.id,
          issuedDate: billDate,
          items: billItems,
        }),
      });
      setBillSaved(true);
      setToastMessage(`Bill saved for ${selectedDealer.name}.`);
      setToastType("success");
      setStep(1);
      setBillItems([]);
      setEditingItemId(null);
      setItemForm({ name: "", category: "", quantity: "", price: "", unit: "kg", image: "" });
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
    setApiError("");
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
        editingDealerId !== null ? `/dealers/${editingDealerId}` : "/dealers",
        { method: editingDealerId !== null ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const updatedDealer = { ...saved, id: saved._id, type: saved.category, image: saved.profileImage };
      if (editingDealerId !== null) {
        setDealerList((items) => items.map((dealer) => dealer.id === editingDealerId ? updatedDealer : dealer));
        setSelectedDealer((dealer) => dealer?.id === editingDealerId ? updatedDealer : dealer);
      } else {
        setDealerList((items) => [updatedDealer, ...items]);
        setSelectedDealer(updatedDealer);
      }
      setEditingDealerId(null);
      setDealerForm({ name: "", phone: "", location: "", type: dealerCategories[0], image: "", cardColor: "#fff3e8", cardBackground: "" });
      setShowDealerForm(false);
      setToastMessage(wasEditing ? "Dealer updated successfully." : "Dealer added successfully.");
      setToastType(wasEditing ? "info" : "success");
    } catch (error) {
      setApiError(error.message);
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
  }

  function cancelDealerEdit() {
    setShowDealerForm(false);
    setEditingDealerId(null);
    setDealerForm({ name: "", phone: "", location: "", type: dealerCategories[0], image: "", cardColor: "#fff3e8", cardBackground: "" });
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
      setToastMessage("Dealer deleted successfully.");
      setToastType("danger");
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsDeletingDealer(false);
    }
  }

  function previewDealerImage(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setDealerForm((current) => ({ ...current, image: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDealerForm((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  }

  function readImageFile(event, field, setForm) {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((current) => ({ ...current, [field]: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, [field]: reader.result }));
    reader.readAsDataURL(file);
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

  function previewItemImage(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setItemForm((current) => ({ ...current, image: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setItemForm((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  }

  return (
    <section className="page-container items-entery">
      {toastMessage && <div className={`app-toast app-toast-${toastType}`} role="status"><i className={`bi ${toastType === "danger" ? "bi-trash3-fill" : toastType === "info" ? "bi-pencil-square" : "bi-check-circle-fill"}`} aria-hidden="true" />{toastMessage}</div>}

      {/* Step indicator */}
      <div className="billing-steps">
        <div className={`billing-step ${step === 1 ? "active" : "completed"}`}>
          <span>1</span>
          <div>
            <strong>Select Dealer</strong>
            <small>Choose customer</small>
          </div>
        </div>

        <div className={`step-line ${step === 2 ? "completed" : ""}`} />

        <div className={`billing-step ${step === 2 ? "active" : ""}`}>
          <span>2</span>
          <div>
            <strong>Bill Details</strong>
            <small>Enter item details</small>
          </div>
        </div>
      </div>

      {apiError && <p className="api-error" role="alert">{apiError} Make sure MongoDB and the backend server are running.</p>}

      {dealerToDelete && (
        <div className="dealer-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingDealer) setDealerToDelete(null); }}>
          <section className="dealer-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dealer-delete-title" aria-describedby="dealer-delete-description">
            <div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div>
            <h2 id="dealer-delete-title">Delete dealer?</h2>
            <p id="dealer-delete-description">Are you sure you want to delete <strong>{dealerToDelete.name}</strong>? This action cannot be undone.</p>
            <div className="dealer-delete-actions">
              <button type="button" className="back-button" disabled={isDeletingDealer} onClick={() => setDealerToDelete(null)}>Cancel</button>
              <button type="button" className="confirm-delete-btn" disabled={isDeletingDealer} onClick={deleteDealer}>{isDeletingDealer ? "Deleting…" : "Delete dealer"}</button>
            </div>
          </section>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="boarder-box">
          <div className="dealer-header">
            <div>
              <h2 className="page-title">Select Dealer</h2>
              <p>Choose a dealer to create a new bill.</p>
            </div>

            <button type="button" className="add-dealer-btn" onClick={() => setShowDealerForm((show) => !show)}>
              <i className="bi bi-plus-lg"></i> Add Dealer
            </button>
          </div>

          {showDealerForm && (
            <form className="dealer-form" onSubmit={addDealer}>
              <h3>{editingDealerId !== null ? "Edit dealer" : "Add a dealer"}</h3>
              <div className="dealer-form-grid">
                <label>Dealer name<input className="form-control" value={dealerForm.name} onChange={(event) => setDealerForm({ ...dealerForm, name: event.target.value })} required /></label>
                <label>Phone number<input className="form-control" type="tel" value={dealerForm.phone} onChange={(event) => setDealerForm({ ...dealerForm, phone: event.target.value })} required /></label>
                <label>Location<input className="form-control" value={dealerForm.location} onChange={(event) => setDealerForm({ ...dealerForm, location: event.target.value })} required /></label>
                <label>Dealer category<select className="form-select" value={dealerForm.type} onChange={(event) => setDealerForm({ ...dealerForm, type: event.target.value })}>{dealerCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>New dealer category<div className="category-add-control"><input className="form-control" value={newDealerCategory} onChange={(event) => setNewDealerCategory(event.target.value)} placeholder="Add a category" /><button type="button" className="back-button" onClick={addDealerCategory}>Add</button></div></label>
                <label>Profile photo (optional)<input className="form-control" type="file" accept="image/*" onChange={previewDealerImage} /></label>
                <label>Card background color<input className="form-control form-control-color" type="color" value={dealerForm.cardColor} onChange={(event) => setDealerForm({ ...dealerForm, cardColor: event.target.value })} /></label>
                <label>Card background image (optional)<input className="form-control" type="file" accept="image/*" onChange={(event) => readImageFile(event, "cardBackground", setDealerForm)} /></label>
              </div>
              {dealerForm.image && <img className="dealer-photo-preview" src={dealerForm.image} alt="Dealer profile preview" />}
              <div className="dealer-form-actions">
                <button type="button" className="back-button" onClick={cancelDealerEdit}>Cancel</button>
                <button type="submit" className="continue-btn">{editingDealerId !== null ? "Update dealer" : "Save dealer"}</button>
              </div>
            </form>
          )}

          <div className="dealer-search">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="Search dealer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {dealerList.length === 0 && !apiError && <p className="dealer-empty-state">No dealers saved yet. Add your first dealer to get started.</p>}

          <div className="row g-3 mt-3">
            {filteredDealers.map((dealer) => (
              <div className="col-lg-4 col-md-6 col-12" key={dealer.id}>
                <div
                  className={`dealer-card ${
                    selectedDealer?.id === dealer.id ? "selected" : ""
                  }`}
                  style={{
                    backgroundColor: dealer.cardColor || "var(--color-surface)",
                    backgroundImage: dealer.cardBackground
                      ? `linear-gradient(rgb(255 255 255 / 82%), rgb(255 255 255 / 82%)), url(${dealer.cardBackground})`
                      : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  onClick={() => setSelectedDealer(dealer)}
                >
                  <div className="dealer-card-top">
                    <div className="dealer-avatar">
                      {dealer.image
                        ? <img src={dealer.image} alt={`${dealer.name} profile`} />
                        : dealer.name.substring(0, 2).toUpperCase()}
                    </div>

                    {selectedDealer?.id === dealer.id && (
                      <i className="bi bi-check-circle-fill selected-icon" />
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

                  <h5>{dealer.name}</h5>
                  <span className="dealer-type">{dealer.type}</span>

                  <div className="dealer-info">
                    <p><i className="bi bi-telephone" /> {dealer.phone}</p>
                    <p><i className="bi bi-geo-alt" /> {dealer.location}</p>
                  </div>

                  <button
                    type="button"
                    className={`select-dealer-btn ${
                      selectedDealer?.id === dealer.id ? "active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDealer(dealer);
                    }}
                  >
                    {selectedDealer?.id === dealer.id
                      ? "Selected"
                      : "Select Dealer"}
                  </button>
                </div>
              </div>
            ))}

            {filteredDealers.length === 0 && (
              <div className="col-12 text-center py-4">
                No dealers found.
              </div>
            )}
          </div>

          <div className="dealer-footer">
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
              Continue <i className="bi bi-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 - BILL FORM */}
      {step === 2 && (
        <div className="boarder-box">
          <div className="bill-header">
            <div>
              <h2 className="page-title">Enter Bill Details</h2>
              <p>Enter the items purchased by the selected dealer.</p>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={() => setStep(1)}
            >
              <i className="bi bi-arrow-left" /> Change Dealer
            </button>
          </div>

          <div className="selected-dealer-info">
            <i className="bi bi-person-circle" />
            <div>
              <small>Selected Dealer</small>
              <strong>{selectedDealer.name}</strong>
              <span>{selectedDealer.phone} · {selectedDealer.location}</span>
            </div>
          </div>

          <div className="bill-date-field">
            <label className="label-title" htmlFor="billDate">Bill issued date</label>
            <input id="billDate" type="date" className="form-control" value={billDate} onChange={(event) => { setBillDate(event.target.value); setBillSaved(false); }} required />
          </div>

          <form onSubmit={addBillItem}>
            <div className="row g-4 px-2 mt-2">
              <div className="col-lg-6 col-12">
                <div className="row g-3">
                <div className="col-md-6 col-12">
                  <div className="form-group">
                    <label className="label-title" htmlFor="itemName">Item Name</label>
                    <input id="itemName" className="form-control" placeholder="Enter item name" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} required />
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


                <div className="col-md-6 col-12">
                  <div className="form-group">
                    <label className="label-title" htmlFor="quantity">Quantity</label>
                    <input id="quantity" type="number" min="0.01" step="any" className="form-control" placeholder="Enter quantity" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} required />
                  </div>
                </div>

                <div className="col-md-6 col-12">
                  <div className="form-group">
                    <label className="label-title" htmlFor="price">Price per unit (₹)</label>
                    <input id="price" type="number" min="0" step="0.01" className="form-control" placeholder="Enter price" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })} required />
                  </div>
                </div>

                <div className="col-md-6 col-12">
                  <div className="form-group">
                    <label className="label-title" htmlFor="unit">Unit</label>
                    <select id="unit" className="form-select" value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })}>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="ton">Ton</option>
                    </select>
                  </div>
                </div>
              </div>
              </div>

              <div className="col-lg-6 col-12">
                <div className="boarder-box h-100">
                  <label className="label-title" htmlFor="itemImage">
                    Item Image <small className="text-muted">Optional</small>
                  </label>
                  <input id="itemImage" type="file" accept="image/*" className="form-control" onChange={previewItemImage} />
                  <div className="image-preview mt-3">
                    {itemForm.image ? <img src={itemForm.image} alt="Selected item preview" /> : <><i className="bi bi-image" /><span>Image preview will appear here</span></>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bill-actions">
              {editingItemId !== null && (
                <button type="button" className="back-button" onClick={cancelItemEdit}>Cancel edit</button>
              )}
              <button type="submit" className="continue-btn">
                <i className={`bi ${editingItemId !== null ? "bi-check-lg" : "bi-plus-lg"}`} />
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
              <strong>Total: ₹{billTotal.toFixed(2)}</strong>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr><th>S.No.</th><th>Item</th><th>Category</th><th>Quantity</th><th>Price / unit</th><th>Amount</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {billItems.length === 0 ? (
                    <tr><td colSpan="7" className="bill-empty">Added items will appear here.</td></tr>
                  ) : billItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td className="bill-item-name">{item.image && <img className="bill-item-thumb" src={item.image} alt="" />}{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>₹{item.price.toFixed(2)}</td>
                      <td>₹{(item.quantity * item.price).toFixed(2)}</td>
                      <td>
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

          <div className="bill-actions">
            <button type="button" className="back-button" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="continue-btn" disabled={billItems.length === 0 || isSaving} onClick={saveBill}>
              {isSaving ? "Saving…" : "Save Bill"}
            </button>
          </div>
          {billSaved && <p className="bill-success" role="status">Bill saved for {selectedDealer.name}.</p>}
        </div>
      )}
    </section>
  );
}

export default Itemsentry;
