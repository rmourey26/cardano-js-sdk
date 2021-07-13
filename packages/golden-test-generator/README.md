# Golden Test Generator
Generate golden test files for a range of Cardano concepts, for the purpose of comparing results 
with application state during integration tests. The intended interface is the CLI, but the 
module is structured to offer access as libraries.

## Install
Get [latest release], artifact of [continuous integration], or package from source:

``` console
yarn pkg
```

## Run
```console
./build/golden-test-generator-{ linux | macos } --help
```
[latest release]: https://github.com/input-output-hk/cardano-js-sdk/releases
[continuous integration]: https://github.com/input-output-hk/cardano-js-sdk/actions/workflows/continuous-integration.yaml
