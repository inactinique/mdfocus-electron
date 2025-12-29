import { create } from 'zustand'
import i18n from '../i18n'
import type { SupportedLanguage } from '../i18n'

interface LanguageState {
  currentLanguage: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => Promise<void>
  initializeLanguage: () => Promise<void>
}

export const useLanguageStore = create<LanguageState>((set) => ({
  currentLanguage: 'fr',

  setLanguage: async (language: SupportedLanguage) => {
    try {
      // Changer la langue dans i18next
      await i18n.changeLanguage(language)

      // Sauvegarder dans la configuration
      await window.electron.config.set('language', language)

      // Mettre à jour le store
      set({ currentLanguage: language })

      // Notifier le main process pour mettre à jour les menus
      window.electron.ipcRenderer.send('language-changed', language)
    } catch (error) {
      console.error('Error changing language:', error)
    }
  },

  initializeLanguage: async () => {
    try {
      // Charger la langue depuis la configuration
      const savedLanguage = await window.electron.config.get('language')

      if (savedLanguage && ['fr', 'en', 'de'].includes(savedLanguage)) {
        await i18n.changeLanguage(savedLanguage)
        set({ currentLanguage: savedLanguage as SupportedLanguage })
      } else {
        // Détecter la langue du système
        const systemLanguage = navigator.language.split('-')[0]
        const language = (['fr', 'en', 'de'].includes(systemLanguage)
          ? systemLanguage
          : 'fr') as SupportedLanguage

        await i18n.changeLanguage(language)
        set({ currentLanguage: language })
      }
    } catch (error) {
      console.error('Error initializing language:', error)
    }
  }
}))
