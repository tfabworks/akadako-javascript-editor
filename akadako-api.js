// AkaDako JavaScript API カタログ。
// エディタの補完・リファレンス表示・センサーモニタで使用する。
// 各エントリ: name, sig (表示), doc (日本語説明), insert (挿入テキスト)
// akadako.js (https://github.com/tfabworks/akadako.js) の API に対応。

const BOARD_API = [
  // --- 接続 ---
  ["disconnect", "disconnect()", "ボードを切断する", "disconnect()"],
  ["isConnected", "isConnected", "接続中かどうか (プロパティ)", "isConnected"],
  ["onDisconnected", "onDisconnected(handler)", "切断されたときに handler を実行", "onDisconnected("],

  // --- I2Cセンサー (await で値を取得) ---
  ["fetchTemperature", "await fetchTemperature() → number", "温度 (℃)", "fetchTemperature()"],
  ["fetchHumidity", "await fetchHumidity() → number", "湿度 (%)", "fetchHumidity()"],
  ["fetchPressure", "await fetchPressure() → number", "気圧 (hPa)", "fetchPressure()"],
  ["fetchBrightness", "await fetchBrightness() → number", "明るさ I2C (lx)", "fetchBrightness()"],
  ["fetchOpticalDistance", "await fetchOpticalDistance() → number", "レーザー距離 (cm)", "fetchOpticalDistance()"],
  ["fetchWaterTemperatureA", "await fetchWaterTemperatureA() → number", "水温 デジタルA (℃)", "fetchWaterTemperatureA()"],
  ["fetchAccelerationX", "await fetchAccelerationX() → number", "加速度 X (m/s²)", "fetchAccelerationX()"],
  ["fetchAccelerationY", "await fetchAccelerationY() → number", "加速度 Y (m/s²)", "fetchAccelerationY()"],
  ["fetchAccelerationZ", "await fetchAccelerationZ() → number", "加速度 Z (m/s²)", "fetchAccelerationZ()"],
  ["fetchAccelerationMagnitude", "await fetchAccelerationMagnitude() → number", "加速度の大きさ (m/s²)", "fetchAccelerationMagnitude()"],
  ["fetchPitch", "await fetchPitch() → number", "ピッチ角 (度)", "fetchPitch()"],
  ["fetchRoll", "await fetchRoll() → number", "ロール角 (度)", "fetchRoll()"],

  // --- アナログ入力 (0-100%, 同期) ---
  ["analogA1", "analogA1() → number", "アナログ A1 (0-100%)", "analogA1()"],
  ["analogA2", "analogA2() → number", "アナログ A2 (0-100%)", "analogA2()"],
  ["analogB1", "analogB1() → number", "アナログ B1 (0-100%)", "analogB1()"],
  ["analogB2", "analogB2() → number", "アナログ B2 (0-100%)", "analogB2()"],
  ["analogBrightness", "analogBrightness() → number", "内蔵アナログ照度 (B2)", "analogBrightness()"],

  // --- デジタル入力 (boolean, 同期) ---
  ["digitalA1", "digitalA1() → boolean", "デジタル A1", "digitalA1()"],
  ["digitalA2", "digitalA2() → boolean", "デジタル A2", "digitalA2()"],
  ["digitalB1", "digitalB1() → boolean", "デジタル B1", "digitalB1()"],
  ["digitalB2", "digitalB2() → boolean", "デジタル B2", "digitalB2()"],
  ["motionSensor", "motionSensor() → boolean", "内蔵モーション(人感)センサー", "motionSensor()"],

  // --- 出力 (await で完了を待つ) ---
  ["runDigitalSet", "await runDigitalSet(target, level)", "デジタル出力 ON/OFF (level: true/false)", "runDigitalSet("],
  ["runPwmSet", "await runPwmSet(target, level)", "PWM出力 (level: 0-100)", "runPwmSet("],
  ["runServoTurn", "await runServoTurn(target, speed, angle)", "サーボを回す (speed:0-100, angle:度)", "runServoTurn("],
  ["runPinBiasSet", "await runPinBiasSet(pin, bias)", "入力ピンのプルアップ設定", "runPinBiasSet("],

  // --- カラーLED (NeoPixel) ---
  ["runColorLedSetStrip", "await runColorLedSetStrip(target, length)", "LEDテープの個数を設定", "runColorLedSetStrip("],
  ["runColorLedSetColor", "await runColorLedSetColor(target, position, color)", "1つのLEDに色 (position:1始まり)", "runColorLedSetColor("],
  ["runColorLedFillColor", "await runColorLedFillColor(target, color)", "全LEDを同色に", "runColorLedFillColor("],
  ["runColorLedShiftColor", "await runColorLedShiftColor(target, n, loop)", "色をずらす", "runColorLedShiftColor("],
  ["runColorLedShow", "await runColorLedShow()", "LEDの表示を反映", "runColorLedShow()"],
  ["runColorLedClear", "await runColorLedClear(target)", "LEDを消灯", "runColorLedClear("],

  // --- IRリモコン / I2C ---
  ["runIrRemoteSend", "await runIrRemoteSend(target, command)", "赤外線リモコン送信 (command:0-9)", "runIrRemoteSend("],
  ["runI2cWrite", "await runI2cWrite(address, register, data)", "I2C書き込み", "runI2cWrite("],
  ["fetchI2cRead", "await fetchI2cRead(address, register, length)", "I2C読み出し → number[]", "fetchI2cRead("],

  // --- 通信（共有サーバー）---
  ["runShareConnect", "await runShareConnect(groupId)", "通信: グループに接続（groupId は合言葉）", "runShareConnect("],
  ["runShareSend", "await runShareSend(label, data)", "通信: ラベルを付けて値を送る", "runShareSend("],
  ["sharedData", "sharedData(label) → string", "通信: 受け取った値を取り出す", "sharedData("],
  ["isShareServerConnected", "isShareServerConnected", "通信: 共有サーバーに接続中か (プロパティ)", "isShareServerConnected"],

  // --- バージョン ---
  ["fetchVersion", "await fetchVersion() → string", "ボードのバージョン", "fetchVersion()"],
  ["fetchUid", "await fetchUid() → string", "ボードのUID", "fetchUid()"],
].map(([name, sig, doc, insert]) => ({ name, sig, doc, insert }));

const AKADAKO_STATICS = [
  ["connect", "await connect() → AkaDako", "ボードに接続して board を返す", "connect()"],
  ["ServoWrite", "ServoWrite", "サーボ出力先 (.A1 .A2 .B1 .B2)", "ServoWrite."],
  ["PwmWrite", "PwmWrite", "PWM出力先 (.A1 .A2 .B1 .B2 .VibrationMotorOnBoard)", "PwmWrite."],
  ["DigitalWrite", "DigitalWrite", "デジタル出力先 (.A1 .A2 .B1 .B2 .RelayOnBoard)", "DigitalWrite."],
  ["DigitalRead", "DigitalRead", "デジタル入力先 (.A1 .A2 .B1 .B2 .ButtonA .ButtonB .MotionSensor)", "DigitalRead."],
  ["AnalogRead", "AnalogRead", "アナログ入力先 (.A1 .A2 .B1 .B2)", "AnalogRead."],
  ["ColorLed", "ColorLed", "カラーLED接続先 (.A1 .A2 .B1 .B2 .OnBoard)", "ColorLed."],
  ["IrRemoteWrite", "IrRemoteWrite", "赤外線出力先 (.A1 .OnBoard)", "IrRemoteWrite."],
  ["PinBias", "PinBias", "プルアップ設定 (.None / .PullUp)", "PinBias."],
  ["Color", "Color", "色 (.Red .Green .Blue など / new AkaDako.Color(r,g,b))", "Color."],
  ["Rainbow", "Rainbow", "レインボー（new AkaDako.Rainbow(明るさ0-100) で作成）", "Rainbow("],
].map(([name, sig, doc, insert]) => ({ name, sig, doc, insert }));

window.AKADAKO_BOARD_API = BOARD_API;
window.AKADAKO_STATICS = AKADAKO_STATICS;

// --- センサーモニタ / サンプル生成の定義 ------------------------------------
// probe: 接続時にセンサーの有無を調べるグループ。代表メソッドが応答したら
//        グループ内の全センサーを「見つかった」として扱う。
// expr:  生成するサンプルHTML内で値を読む式（board. に続く部分）
window.AKADAKO_SENSOR_DEFS = [
  { key: "fetchTemperature",           label: "温度",           unit: "℃",    async: true,  probeGroup: "bme280" },
  { key: "fetchHumidity",              label: "湿度",           unit: "%",     async: true,  probeGroup: "bme280" },
  { key: "fetchPressure",              label: "気圧",           unit: "hPa",   async: true,  probeGroup: "bme280" },
  { key: "fetchBrightness",            label: "明るさ(I2C)",    unit: "lx",    async: true,  probeGroup: "ltr303" },
  { key: "fetchOpticalDistance",       label: "距離(レーザー)", unit: "cm",    async: true,  probeGroup: "vl53l0x" },
  { key: "fetchWaterTemperatureA",     label: "水温A",          unit: "℃",    async: true,  probeGroup: "watertemp" },
  { key: "fetchAccelerationX",         label: "加速度X",        unit: "m/s²",  async: true,  probeGroup: "accel" },
  { key: "fetchAccelerationY",         label: "加速度Y",        unit: "m/s²",  async: true,  probeGroup: "accel" },
  { key: "fetchAccelerationZ",         label: "加速度Z",        unit: "m/s²",  async: true,  probeGroup: "accel" },
  { key: "fetchPitch",                 label: "ピッチ",         unit: "度",    async: true,  probeGroup: "accel" },
  { key: "fetchRoll",                  label: "ロール",         unit: "度",    async: true,  probeGroup: "accel" },
  { key: "analogBrightness",           label: "明るさ(内蔵)",   unit: "%",     async: false, probeGroup: "always" },
  { key: "motionSensor",               label: "人感センサー",   unit: "",      async: false, probeGroup: "always" },
  { key: "analogA1",                   label: "アナログA1",     unit: "%",     async: false, probeGroup: "always" },
  { key: "digitalA1",                  label: "デジタルA1",     unit: "",      async: false, probeGroup: "always" },
];

// probeGroup → 有無を確認する代表メソッド名 ("always" は常に有効)
window.AKADAKO_PROBE_REPS = {
  bme280: "fetchTemperature",
  ltr303: "fetchBrightness",
  vl53l0x: "fetchOpticalDistance",
  watertemp: "fetchWaterTemperatureA",
  accel: "fetchAccelerationX",
};
