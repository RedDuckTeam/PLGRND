export const PageLoader = () => {
  const logoSrc = document.documentElement.dataset.theme === 'light' ? '/logo.png' : '/logo-light.png'
  return (
    <div className="w-screen h-screen bg-background absolute flex items-center justify-center inset-0 z-50">
      <div className="flex items-center gap-2">
        <img src={logoSrc} alt="logo" className="sm:w-[250px] sm:h-[250px] w-10 h-10" />
      </div>
    </div>
  )
}
