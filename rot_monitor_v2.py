# encoder_monitor_qt.py
# PySide6/PyQt5 両対応・UDP検出・/apiポーリング・円/棒グラフ切替

import sys, json, socket, time, math, concurrent.futures
from functools import partial

# ==== Qt バインディング互換レイヤ ====
qt_api = None
try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
    qt_api = "PySide6"
except Exception:
    from PyQt5 import QtCore, QtGui, QtWidgets
    from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
    qt_api = "PyQt5"

import requests
from matplotlib.figure import Figure

DISCOVERY_PORT = 4210
DISCOVERY_TOKEN = b"DISCOVER_ENCODER"

# ================= FlowLayout（自動折返しレイアウト） =================
class FlowLayout(QtWidgets.QLayout):
    def __init__(self, parent=None, margin=0, hspacing=8, vspacing=8):
        super().__init__(parent)
        self._items = []
        self.setContentsMargins(margin, margin, margin, margin)
        self.hspacing = hspacing
        self.vspacing = vspacing

    def addItem(self, item): self._items.append(item)
    def count(self): return len(self._items)
    def itemAt(self, idx): return self._items[idx] if 0 <= idx < len(self._items) else None
    def takeAt(self, idx): return self._items.pop(idx) if 0 <= idx < len(self._items) else None
    def expandingDirections(self): return QtCore.Qt.Orientations(QtCore.Qt.Orientation(0))
    def hasHeightForWidth(self): return True
    def heightForWidth(self, w): return self._do_layout(QtCore.QRect(0,0,w,0), True)
    def setGeometry(self, rect): super().setGeometry(rect); self._do_layout(rect, False)
    def sizeHint(self): return self.minimumSize()
    def minimumSize(self):
        s = QtCore.QSize()
        for i in self._items:
            s = s.expandedTo(i.minimumSize())
        m = self.contentsMargins()
        s += QtCore.QSize(m.left()+m.right(), m.top()+m.bottom())
        return s

    def _do_layout(self, rect, test_only):
        x = rect.x(); y = rect.y(); line_height = 0
        m = self.contentsMargins()
        x += m.left(); y += m.top()
        right = rect.right() - m.right()
        for item in self._items:
            w = item.sizeHint().width()
            h = item.sizeHint().height()
            next_x = x + w + self.hspacing
            if next_x - self.hspacing > right and line_height > 0:
                x = rect.x() + m.left()
                y += line_height + self.vspacing
                next_x = x + w + self.hspacing
                line_height = 0
            if not test_only:
                item.setGeometry(QtCore.QRect(QtCore.QPoint(x, y), item.sizeHint()))
            x = next_x
            line_height = max(line_height, h)
        return y + line_height + m.bottom() - rect.y()

# ================= デバイスモデル =================
class Device(QtCore.QObject):
    changed = QtCore.Signal() if qt_api=="PySide6" else QtCore.pyqtSignal()
    def __init__(self, dev_id, ip):
        super().__init__()
        self.id = dev_id
        self.ip = ip
        self.value = 0.0
        self.last_seen = None

    def set_value(self, v):
        v = max(0.0, min(100.0, float(v)))
        if abs(v - self.value) > 1e-6:
            self.value = v
            self.changed.emit()

    def touch(self):
        self.last_seen = time.strftime("%H:%M:%S")
        self.changed.emit()

# ================= Matplotlib キャンバス =================
class MplCanvas(FigureCanvas):
    def __init__(self, width=3.4, height=2.2, dpi=100):
        self.fig = Figure(figsize=(width, height), dpi=dpi)
        super().__init__(self.fig)
        self.ax = self.fig.add_subplot(111)
        self.fig.tight_layout(pad=1.2)

    def draw_bar(self, val):
        self.ax.clear()
        self.ax.set_ylim(0, 100)
        self.ax.set_xlim(-0.5, 0.5)
        self.ax.bar([0], [val])
        self.ax.set_ylabel("Percent")
        self.ax.set_xticks([])
        # 値ラベル
        self.ax.text(0, min(100, val + 4), f"{val:.0f}%", ha="center", va="bottom", fontsize=12)
        self.fig.canvas.draw_idle()

    def draw_pie(self, val):
        self.ax.clear()
        remain = max(0, 100 - val)
        wedges, texts, autotexts = self.ax.pie(
            [val, remain],
            labels=["Value", "Remain"],
            autopct=lambda pct: f"{pct:.0f}%",
            startangle=90
        )
        self.ax.axis("equal")
        self.fig.canvas.draw_idle()

# ================= デバイスごとのウィジェット =================
class DeviceWidget(QtWidgets.QFrame):
    def __init__(self, device: Device, use_pie: bool):
        super().__init__()
        self.device = device
        self.use_pie = use_pie
        self.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.setFixedSize(340, 300)

        v = QtWidgets.QVBoxLayout(self); v.setContentsMargins(8,8,8,8); v.setSpacing(6)
        self.lblTitle = QtWidgets.QLabel(f"{device.id}")
        self.lblTitle.setStyleSheet("font-weight:600;")
        self.lblIp = QtWidgets.QLabel(device.ip)
        self.lblIp.setStyleSheet("color:#666;")
        self.canvas = MplCanvas()
        self.progress = QtWidgets.QProgressBar(); self.progress.setRange(0,100)
        self.lblVal = QtWidgets.QLabel("現在値: 0%")

        v.addWidget(self.lblTitle)
        v.addWidget(self.lblIp)
        v.addWidget(self.canvas, 1)
        v.addWidget(self.progress)
        v.addWidget(self.lblVal)

        device.changed.connect(self.refresh)
        self.refresh()

    def set_mode(self, use_pie: bool):
        if self.use_pie != use_pie:
            self.use_pie = use_pie
            self.refresh(force=True)

    def refresh(self, force=False):
        self.lblIp.setText(f"{self.device.ip}   " + (f"Last: {self.device.last_seen}" if self.device.last_seen else "(未受信)"))
        self.progress.setValue(int(round(self.device.value)))
        self.lblVal.setText(f"現在値: {self.device.value:.0f}%")
        if self.use_pie:
            self.canvas.draw_pie(self.device.value)
        else:
            self.canvas.draw_bar(self.device.value)

# ================= メインウィンドウ =================
class MainWindow(QtWidgets.QMainWindow):
    dataUpdated = QtCore.Signal(str, float) if qt_api=="PySide6" else QtCore.pyqtSignal(str, float)
    devicesDiscovered = QtCore.Signal(list) if qt_api=="PySide6" else QtCore.pyqtSignal(list)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Encoder Monitor (Qt)")
        self.resize(1100, 700)

        # 状態
        self.devices = {}          # id -> Device
        self.deviceWidgets = {}    # id -> DeviceWidget
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)

        # 中央ウィジェット
        central = QtWidgets.QWidget(self)
        self.setCentralWidget(central)
        layout = QtWidgets.QHBoxLayout(central); layout.setContentsMargins(8,8,8,8); layout.setSpacing(8)

        # 左パネル
        left = QtWidgets.QVBoxLayout(); left.setSpacing(6)
        self.btnDiscover = QtWidgets.QPushButton("検出(UDP)")
        self.btnClear = QtWidgets.QPushButton("全解除")
        topRow = QtWidgets.QHBoxLayout(); topRow.addWidget(self.btnDiscover); topRow.addWidget(self.btnClear); topRow.addStretch()
        left.addLayout(topRow)

        self.chkPie = QtWidgets.QCheckBox("円グラフで表示"); self.chkPie.setChecked(True)
        left.addWidget(self.chkPie)

        left.addWidget(QtWidgets.QLabel("ポーリング周期(ms)"))
        self.spinPoll = QtWidgets.QSpinBox(); self.spinPoll.setRange(50, 5000); self.spinPoll.setValue(200); self.spinPoll.setSingleStep(50)
        left.addWidget(self.spinPoll)

        left.addWidget(QtWidgets.QLabel("可視化するデバイスに✔"))
        self.list = QtWidgets.QListWidget(); self.list.setSelectionMode(QtWidgets.QAbstractItemView.SelectionMode.NoSelection)
        left.addWidget(self.list, 1)

        layout.addLayout(left, 0)

        # 右：キャンバス群（FlowLayout）
        rightContainer = QtWidgets.QWidget()
        self.flow = FlowLayout(rightContainer, margin=0, hspacing=8, vspacing=8)
        scroll = QtWidgets.QScrollArea(); scroll.setWidgetResizable(True); scroll.setWidget(rightContainer)
        layout.addWidget(scroll, 1)

        # タイマー：ポーリング
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(self.spinPoll.value())
        self.timer.timeout.connect(self.poll_once)

        # シグナル
        self.btnDiscover.clicked.connect(self.discover_clicked)
        # self.btnClear.clicked.connect(self.clear_all)
        self.list.itemChanged.connect(self.list_item_changed)
        self.chkPie.toggled.connect(self.toggle_mode)
        self.spinPoll.valueChanged.connect(self.timer.setInterval)

        self.dataUpdated.connect(self.on_value_from_worker)
        self.devicesDiscovered.connect(self.on_devices_discovered)

    # ---------- 検出 ----------
    def discover_clicked(self):
        # ワーカースレッドでUDP検出→結果をUIスレッドへ
        self.executor.submit(self._discover_worker)

    def _discover_worker(self):
        results = []
        try:
            udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            udp.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            udp.settimeout(0.8)
            udp.sendto(DISCOVERY_TOKEN, ("<broadcast>", DISCOVERY_PORT))
            start = time.time()
            while time.time() - start < 0.8:
                try:
                    data, addr = udp.recvfrom(2048)
                    obj = json.loads(data.decode("utf-8", errors="ignore"))
                    if obj.get("type") == "encoder" and obj.get("id") and obj.get("ip"):
                        results.append((obj["id"], obj["ip"]))
                except socket.timeout:
                    break
                except Exception:
                    pass
            udp.close()
        except Exception:
            pass
        # 重複除去
        uniq = {}
        for i, p in results: uniq[i] = p
        self.devicesDiscovered.emit([(i, uniq[i]) for i in uniq])

    @QtCore.Slot(list) if qt_api=="PySide6" else QtCore.pyqtSlot(list)
    def on_devices_discovered(self, items):
        for dev_id, ip in items:
            if dev_id not in self.devices:
                dev = Device(dev_id, ip)
                self.devices[dev_id] = dev

                # 左のチェックリストに追加（既定で✔）
                it = QtWidgets.QListWidgetItem(f"{dev_id}  ({ip})")
                it.setFlags(it.flags() | QtCore.Qt.ItemFlag.ItemIsUserCheckable)
                it.setCheckState(QtCore.Qt.CheckState.Checked)
                it.setData(QtCore.Qt.ItemDataRole.UserRole, dev_id)
                self.list.addItem(it)

                # 右側にキャンバス生成
                w = DeviceWidget(dev, use_pie=self.chkPie.isChecked())
                self.deviceWidgets[dev_id] = w
                self.flow.addWidget(w)
            else:
                dev = self.devices[dev_id]
                dev.ip = ip
                dev.touch()  # Last seen更新
                # 表示側も更新
                for row in range(self.list.count()):
                    it = self.list.item(row)
                    if it.data(QtCore.Qt.ItemDataRole.UserRole) == dev_id:
                        it.setText(f"{dev_id}  ({ip})")
                if dev_id in self.deviceWidgets:
                    self.deviceWidgets[dev_id].refresh(force=True)

        if not self.timer.isActive():
            self.timer.start()

    # ---------- リストで✔の変更 ----------
    def list_item_changed(self, item: QtWidgets.QListWidgetItem):
        dev_id = item.data(QtCore.Qt.ItemDataRole.UserRole)
        checked = item.checkState() == QtCore.Qt.CheckState.Checked
        w = self.deviceWidgets.get(dev_id)
        if checked and w is None and dev_id in self.devices:
            # 追加
            dev = self.devices[dev_id]
            w = DeviceWidget(dev, use_pie=self.chkPie.isChecked())
            self.deviceWidgets[dev_id] = w
            self.flow.addWidget(w)
        elif (not checked) and w is not None:
            # 削除
            w.setParent(None)
            w.deleteLater()
            self.deviceWidgets.pop(dev_id, None)

    # ---------- 円/棒の一括切替 ----------
    def toggle_mode(self, checked):
        for w in list(self.deviceWidgets.values()):
            w.set_mode(checked)

    # ---------- ポーリング ----------
    def poll_once(self):
        targets = []
        for row in range(self.list.count()):
            it = self.list.item(row)
            if it.checkState() == QtCore.Qt.CheckState.Checked:
                dev_id = it.data(QtCore.Qt.ItemDataRole.UserRole)
                if dev_id in self.devices:
                    targets.append(self.devices[dev_id])

        # 並列でGET
        for dev in targets:
            self.executor.submit(self._poll_device, dev)

    def _poll_device(self, dev: Device):
        url = f"http://{dev.ip}/api"
        try:
            r = requests.get(url, timeout=1.0)
            r.raise_for_status()
            obj = r.json()
            val = float(obj.get("calibrated_value", 0))
            self.dataUpdated.emit(dev.id, val)
        except Exception:
            # 失敗は黙殺（ネットワーク瞬断等）
            pass

    @QtCore.Slot(str, float) if qt_api=="PySide6" else QtCore.pyqtSlot(str, float)
    def on_value_from_worker(self, dev_id, val):
        if dev_id in self.devices:
            dev = self.devices[dev_id]
            dev.set_value(val)
            dev.touch()

# ================= エントリポイント =================
def main():
    app = QtWidgets.QApplication(sys.argv)
    w = MainWindow()
    w.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
