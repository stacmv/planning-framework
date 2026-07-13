# Notes  (a FILE in the v2 layout)

In `docs/issues/open/20250101-feat-alpha/` the same name is a DIRECTORY.
No `.v2.md` suffix can resolve this, and a `.v2/` directory would mint a phantom
issue folder. Converge must refuse to move this one, print an ERROR naming BOTH
paths, exit non-zero, and skip phase 5 entirely (D-B, TC-054).
