# Example node index

All times are fictional UTC timestamps on 1 September 2026. Labels and file paths are only in this index, not in the proof archive.

| Label | Type | UTC | Inputs (ordered) | Payload file | PDA |
| --- | --- | --- | --- | --- | --- |
| A | hash | 12:00:00 | — | [file](files/A.txt) | `ByUj8aB6gCETws291fd7GLxYhwrb5NFTvguiRkr9tqiC` |
| B | hash | 12:01:00 | — | [file](files/B.txt) | `7qnLvUkzC3UM6mRjs2QRDQoHNxTTN87kus4kZQAjv6R2` |
| C | hash | 12:03:00 | — | [file](files/C.txt) | `FEhLDXneoazg1qrVWkfZdMvuSViLgwjDGrQQRVFQLzA3` |
| Account | account | 12:04:00 | — | — | `CdVKoYkLaGhMoyja6xoiMkFB2wUmbF1o3mq2gu7uUxKv` |
| A1 | branch | 12:05:00 | A | [file](files/A1.txt) | `C6RyUmZWFyou1LTtwwqZY2FFwkw9RoxeercRFqGFGsvu` |
| B1 | branch | 12:06:00 | B | [file](files/B1.txt) | `DS1v5z9UaCS247LDJf8KX4ySCYT3G5kd6rzscLb56GDy` |
| C1 | branch | 12:07:00 | C | [file](files/C1.txt) | `4wvfwF5t2d2ZnRvm84CfpcHrsygQwhWe7WUq8cSvhti1` |
| B2 | branch | 12:09:00 | B1 | [file](files/B2.txt) | `B1yQU9toc6uF6f88d91bpTHGjskJBvgNimFFbJ6Ck8SE` |
| C2 | branch | 12:10:00 | C1 | [file](files/C2.txt) | `28Vh6cFBnJ6CsMLbUFSKxwk5Q5f2fHYHPGcKZowauLXN` |
| C3 | branch | 12:12:00 | C2 | [file](files/C3.txt) | `AFbQyvu6RptemXF9io28aj8kN2GC62VsebEH3tGjYJHF` |
| B3 | branch | 12:14:00 | B2 | [file](files/B3.txt) | `CWyP6zyA78mJB2A5thSggKTpXRkBv3bebFPJ1brE1S4F` |
| C4 | branch | 12:17:00 | C3 | [file](files/C4.txt) | `BAUVqbnKaNaryE4Mphfbg7G7vqV5Choo41daqqeGPmeY` |
| Batch1 | batch | 12:20:00 | A1, B3, C4 | — | `GVSVW2qUbsRmHWTTN7Pp7VPm1asAPGKcDxbkytx1XGWD` |
| Batch2 | batch | 12:22:00 | B3, C4 | — | `69LGMGqSgjjb5KZFmS84ks79TS62pPAEYQCz3pads3QM` |
| X1 | branch | 12:23:00 | Batch1 | [file](files/X1.txt) | `DfiSLsgtYxL7QeeBWBdMGoRYN1sXEs3gQ4JAa2VLfw9N` |
| Y1 | branch | 12:25:00 | Batch2 | [file](files/Y1.txt) | `2L1M5LhFPBC4AT2ACLRGs9WkPPNqkDbuthKYN8vssCqn` |
| X2 | branch | 12:28:00 | X1 | [file](files/X2.txt) | `DtBboQXVeV8QeM3xEFUGJrJC1KbvK6DDJAALBGMmfUB6` |
| Batch3 | batch | 12:31:00 | X2, Y1 | — | `Bu4fh9dmJQi4Girc1vRfN83pi4NSubTDA4KMTd26a6w6` |
| L1 | branch | 12:33:00 | Batch3 | [file](files/L1.txt) | `DNrcfkbKA45T9ukpGXZaZbUpedtH6J17NAZPinwGeCqw` |
| R1 | branch | 12:34:00 | Batch3 | [file](files/R1.txt) | `9ua8iBeHLkH1b5WNdudRDXoJCeTLxfBqnxuHwhk1KV3K` |
| R2 | branch | 12:37:00 | R1 | [file](files/R2.txt) | `f9gwrbRHgsn4agaz6KkSvmXR5ekFJHT5yZ6WsgCYcHc` |
| L2 | branch | 12:38:00 | L1 | [file](files/L2.txt) | `HedYu31TVzSqgAkRQPjpkS3BYTqHs4Ch3Xo9mK8DDDwd` |
| R3 | branch | 12:42:00 | R2 | [file](files/R3.txt) | `7dCWcygSzgabawF5XbNw5mWfHryJeZh3UoxAsvtCLUtW` |
| Pack | pack | 12:47:00 | L2, R3, Account | — | `2jvodG4Xg4sCFD7j1Ptji3sZh2iUFu87iiRxYby89bxJ` |
