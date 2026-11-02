import multer from 'multer'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 900 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    if (!allowedTypes.has(file.mimetype)) return done(new Error('Choose a JPG, PNG, or WebP profile picture.'))
    done(null, true)
  },
}).single('profilePicture')

export function profilePictureUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next()
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Profile pictures must be 900 KB or smaller.' })
    res.status(400).json({ message: error.message || 'Could not read the profile picture.' })
  })
}
