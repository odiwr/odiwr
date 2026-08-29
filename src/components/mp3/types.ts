/** One entry in the OdiAMP playlist. */
export type AmpTrack = {
  title: string;
  artist: string;
  /** Playable URL — the same-origin /audio proxy, or a blob: for local files. */
  src: string;
  /** True for files the visitor added from their own device this session. */
  local?: boolean;
};
