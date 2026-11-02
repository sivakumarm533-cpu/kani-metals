import Dealer from '../models/Dealer.js'

export async function listDealers(_req, res, next) {
  try {
    res.json(await Dealer.find().sort({ createdAt: -1 }))
  } catch (error) { next(error) }
}

export async function createDealer(req, res, next) {
  try {
    const dealer = await Dealer.create({ ...req.body, category: req.body.category || req.body.type })
    res.status(201).json(dealer)
  } catch (error) { next(error) }
}

export async function updateDealer(req, res, next) {
  try {
    const dealer = await Dealer.findByIdAndUpdate(req.params.id, {
      ...req.body,
      category: req.body.category || req.body.type,
    }, { new: true, runValidators: true })
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    res.json(dealer)
  } catch (error) { next(error) }
}

export async function deleteDealer(req, res, next) {
  try {
    const dealer = await Dealer.findByIdAndDelete(req.params.id)
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    res.json({ message: 'Dealer deleted.' })
  } catch (error) { next(error) }
}
