/** Round profile picture, or the first letter of the name. Used in the app header, More menu and profile page. */
export function Avatar({ user, className = 'navbar-profile-avatar' }) {
  return <span className={className} aria-hidden="true">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : user?.name?.trim()?.[0]?.toUpperCase() || '?'}</span>
}
