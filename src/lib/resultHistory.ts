import type { NavigateFunction } from 'react-router-dom'

/**
 * Reconstruit l'historique après la soumission d'une série / d'un niveau.
 *
 * Juste avant l'appel, la pile est :
 *   [..., /app, /carte-niveau, /qcm, /qcm-garde]
 * (le QCM a poussé une entrée sentinelle « garde » à son montage, et le
 * pointeur est sur cette sentinelle, see QuizPage / MedgameLevelPage).
 *
 * Le bouton retour doit ensuite donner :
 *   1er retour -> /carte-niveau
 *   2e retour  -> /app
 *
 * Pour cela on recule de deux entrées (go(-2) : on repasse sur la carte
 * niveau, les gardes étant désactivées par finished/allowExit), puis on pousse
 * la page résultat. Le push écrase l'ancien futur (l'entrée /qcm) : la pile
 * devient [..., /app, /carte-niveau, /resultat] et le retour natif fonctionne.
 *
 * `fallbackPath` est utilisé quand aucune sentinelle n'est présente (accès
 * direct au QCM) : dans ce cas on se contente d'un replace, sans toucher à
 * l'historique.
 */
export function goToResult(
  navigate: NavigateFunction,
  resultPath: string,
  resultState: unknown,
  guardKey: string,
  fallbackPath: string,
): void {
  const hasGuard = Boolean(
    (window.history.state as Record<string, unknown> | null)?.[guardKey],
  )
  if (!hasGuard) {
    navigate(fallbackPath, { replace: true, state: resultState })
    return
  }

  // On ne pousse le résultat qu'UNE fois que le popstate du go(-2) a eu lieu,
  // sinon React Router change de route dans le désordre et la carte niveau
  // réapparaît derrière le résultat.
  const onBack = () => {
    window.removeEventListener('popstate', onBack, true)
    navigate(resultPath, { state: resultState })
  }
  window.addEventListener('popstate', onBack, true)
  window.history.go(-2)
}
