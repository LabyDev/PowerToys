import { createContext, useContext, useState, useRef, ReactNode } from "react";
import {
  AppStateData,
  PresetState,
  RandomiserPreset,
} from "../../types/filerandomiser";

interface FileRandomiserContextValue {
  data: AppStateData;
  setData: React.Dispatch<React.SetStateAction<AppStateData>>;
  lastAppliedPresetRef: React.MutableRefObject<RandomiserPreset | null>;
  presets: RandomiserPreset[];
  setPresets: (p: RandomiserPreset[]) => void;
  presetState: PresetState;
  setPresetState: React.Dispatch<React.SetStateAction<PresetState>>;
  query: string;
  setQuery: (q: string) => void;
  shuffle: boolean;
  setShuffle: (s: boolean) => void;
  currentIndex: number | null;
  setCurrentIndex: (i: number | null) => void;
  currentIndexRef: React.MutableRefObject<number | null>;
  tracking: boolean;
  setTracking: (t: boolean) => void;
  isCrawling: boolean;
  setIsCrawling: (c: boolean) => void;
  freshCrawl: boolean;
  setFreshCrawl: (fc: boolean) => void;
  treeCollapsed: boolean;
  setTreeCollapsed: (t: boolean) => void;
}

const FileRandomiserContext = createContext<
  FileRandomiserContextValue | undefined
>(undefined);

export const useFileRandomiser = () => {
  const context = useContext(FileRandomiserContext);
  if (!context)
    throw new Error(
      "useFileRandomiser must be used inside FileRandomiserProvider",
    );
  return context;
};

export const FileRandomiserProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
    filterRules: [],
  });

  const lastAppliedPresetRef = useRef<RandomiserPreset | null>(null);
  const [presets, setPresets] = useState<RandomiserPreset[]>([]);
  const [presetState, setPresetState] = useState<PresetState>({
    currentId: null,
    name: "Untitled",
    dirty: false,
    bookmarks: [],
  });

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const currentIndexRef = useRef<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [freshCrawl, setFreshCrawl] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState<boolean>(false);

  return (
    <FileRandomiserContext.Provider
      value={{
        data,
        setData,
        lastAppliedPresetRef,
        presets,
        setPresets,
        presetState,
        setPresetState,
        query,
        setQuery,
        shuffle,
        setShuffle,
        currentIndex,
        setCurrentIndex,
        currentIndexRef,
        tracking,
        setTracking,
        isCrawling,
        setIsCrawling,
        freshCrawl,
        setFreshCrawl,
        treeCollapsed,
        setTreeCollapsed,
      }}
    >
      {children}
    </FileRandomiserContext.Provider>
  );
};
