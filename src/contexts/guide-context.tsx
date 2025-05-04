import React, { createContext, useReducer, useContext, ReactNode, Dispatch } from 'react'
import { Guide, GuideSection } from '@/lib/guide/types'

// --- State Types ---
export interface GuideState {
  guide: Guide | null
  loading: boolean
  error: string | null
}

export type GuideAction =
  | { type: 'LOAD_GUIDE'; payload: Guide }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_METADATA'; payload: Partial<Guide> }
  | { type: 'ADD_SECTION'; payload: GuideSection }
  | { type: 'UPDATE_SECTION'; payload: GuideSection }
  | { type: 'DELETE_SECTION'; payload: string }
  | { type: 'REORDER_SECTIONS'; payload: GuideSection[] }

const initialState: GuideState = {
  guide: null,
  loading: false,
  error: null,
}

function guideReducer(state: GuideState, action: GuideAction): GuideState {
  switch (action.type) {
    case 'LOAD_GUIDE':
      return { ...state, guide: action.payload, loading: false, error: null }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'UPDATE_METADATA':
      return state.guide ? { ...state, guide: { ...state.guide, ...action.payload } } : state
    case 'ADD_SECTION':
      return state.guide
        ? {
            ...state,
            guide: {
              ...state.guide,
              sections: [...state.guide.sections, action.payload],
            },
          }
        : state
    case 'UPDATE_SECTION':
      return state.guide
        ? {
            ...state,
            guide: {
              ...state.guide,
              sections: state.guide.sections.map(s =>
                s.id === action.payload.id ? action.payload : s
              ),
            },
          }
        : state
    case 'DELETE_SECTION':
      return state.guide
        ? {
            ...state,
            guide: {
              ...state.guide,
              sections: state.guide.sections.filter(s => s.id !== action.payload),
            },
          }
        : state
    case 'REORDER_SECTIONS':
      return state.guide
        ? {
            ...state,
            guide: {
              ...state.guide,
              sections: action.payload,
            },
          }
        : state
    default:
      return state
  }
}

const GuideContext = createContext<
  | {
      state: GuideState
      dispatch: Dispatch<GuideAction>
    }
  | undefined
>(undefined)

export const GuideProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(guideReducer, initialState)
  return <GuideContext.Provider value={{ state, dispatch }}>{children}</GuideContext.Provider>
}

export function useGuide() {
  const context = useContext(GuideContext)
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider')
  }
  return context
}
