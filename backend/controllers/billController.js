import Bill from '../models/Bill.js'

export async function listBills(_req, res, next) {
  try { res.json(await Bill.find().populate('dealer').sort({ createdAt: -1 })) }
  catch (error) { next(error) }
}

export async function createBill(req, res, next) {
  try {
    const { dealer, issuedDate, items } = req.body
    const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0)
    const bill = await Bill.create({ dealer, issuedDate, items, total })
    res.status(201).json(await bill.populate('dealer'))
  } catch (error) { next(error) }
}

export async function updateBill(req, res, next) {
  try {
    const { issuedDate, items } = req.body
    const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0)
    const bill = await Bill.findByIdAndUpdate(req.params.id, { issuedDate, items, total }, { new: true, runValidators: true }).populate('dealer')
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    res.json(bill)
  } catch (error) { next(error) }
}

export async function deleteBill(req, res, next) {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id)
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    res.json({ message: 'Bill deleted.' })
  } catch (error) { next(error) }
}
