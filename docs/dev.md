# State pass

## 实操

### 本地部署

```bash
state-pass on  main [!] via 🦀 1.90.0 took 4.6s
➜ make deploy CLUSTER=localnet

Formatting Rust code...
Building program 'state-pass'...
    Finished `release` profile [optimized] target(s) in 0.30s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.20s
     Running unittests src/lib.rs (/Users/qiaopengjun/Code/Solana/state-pass/target/debug/deps/state_pass-4c7586daa69d316b)
Deploying to cluster: localnet...
Deploying cluster: http://localhost:8899
Upgrade authority: /Users/qiaopengjun/.config/solana/id.json
Deploying program "state_pass"...
Program path: /Users/qiaopengjun/Code/Solana/state-pass/target/deploy/state_pass.so...
Program Id: F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV

Signature: 5DdK2shL2eekto3J2DxvqYkX2FYd3wRgV69JEfRcBvjnVSCiMcBhCwCJTXvLah8Ftg7mp42EndwaUp53qjFLySZE

Waiting for program F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV to be confirmed...
Program confirmed on-chain
Idl data length: 1132 bytes
Step 0/1132
Step 600/1132
Idl account created: DCkAgLGcUKvVKNMZFZmiBjVw3YroHorayDj1zFSUukDQ
Deploy success
```

### 测试网部署

```bash
state-pass on  main [!] via 🦀 1.90.0 took 11.0s
➜ make deploy CLUSTER=devnet

Formatting Rust code...
Building program 'state-pass'...
    Finished `release` profile [optimized] target(s) in 0.42s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.24s
     Running unittests src/lib.rs (/Users/qiaopengjun/Code/Solana/state-pass/target/debug/deps/state_pass-4c7586daa69d316b)
Deploying to cluster: devnet...
Deploying cluster: https://solana-devnet.g.alchemy.com/v2/wvX_VlsvVsKAfbkS5P7xu
Upgrade authority: /Users/qiaopengjun/.config/solana/id.json
Deploying program "state_pass"...
Program path: /Users/qiaopengjun/Code/Solana/state-pass/target/deploy/state_pass.so...
Error: 1 write transactions failed
There was a problem deploying: Output { status: ExitStatus(unix_wait_status(256)), stdout: "", stderr: "" }.
make: *** [deploy] Error 1

state-pass on  main [!?] via 🦀 1.90.0 took 58.8s
➜ make deploy CLUSTER=devnet

Formatting Rust code...
Building program 'state-pass'...
    Finished `release` profile [optimized] target(s) in 0.37s
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.23s
     Running unittests src/lib.rs (/Users/qiaopengjun/Code/Solana/state-pass/target/debug/deps/state_pass-4c7586daa69d316b)
Deploying to cluster: devnet...
Deploying cluster: https://solana-devnet.g.alchemy.com/v2/wvX_VlsvVsKAfbkS5P7xu
Upgrade authority: /Users/qiaopengjun/.config/solana/id.json
Deploying program "state_pass"...
Program path: /Users/qiaopengjun/Code/Solana/state-pass/target/deploy/state_pass.so...
Program Id: F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV

Signature: 4JFTTiYsmvhpiNC8FHGMwVCionsszBFSNYKZdfFeLzySvnu5MmJw33LbN9rgZWkVhdvqyzFfpaLnwEa7yfq1FZfv

Waiting for program F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV to be confirmed...
Program confirmed on-chain
Idl data length: 1132 bytes
Step 0/1132
Step 600/1132
Idl account created: DCkAgLGcUKvVKNMZFZmiBjVw3YroHorayDj1zFSUukDQ
Deploy success



make idl-upgrade PROGRAM_ID=F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV
➜ make idl-init PROGRAM_ID=F3uXqosNaNUfi76dSGLQm8CFYdSyRfzZixrVhQNNLqUV
```

## 参考

- <https://solscan.io/tx/4JFTTiYsmvhpiNC8FHGMwVCionsszBFSNYKZdfFeLzySvnu5MmJw33LbN9rgZWkVhdvqyzFfpaLnwEa7yfq1FZfv?cluster=devnet>
