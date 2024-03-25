// TODO List
// - Add counter for recording the total power drawn over the period
// - Better function names and comments
// - Add a function to convert the time from seconds to a more readable format
// - Change output file headers based on device type
// - Add autosave on lost session functionality
// - Add better colours to the graph and table

/* Global Values and Variables*/
// Title
const windowDescription = document.getElementById("window-description")!;
const titleDescription = document.getElementById("title-description")!;

// Filenaming
const filenameInput = document.getElementById('filename') as HTMLInputElement;

// Buttons
const goButton = document.getElementById("go")!;
const pauseElem = document.getElementById("pause")!;
const lengthNumber = document.getElementById("length")! as HTMLInputElement;
const reconnectSwitch = document.getElementById("reconnect")! as HTMLInputElement;

// Dialog
const dialogElem = document.getElementById('dialog')! as HTMLDialogElement;
const dialogMessageElem = document.getElementById('dialogError')!;
const warnBlockElem = document.getElementById("warnBlock")!;

// Table values
const voltageElem = document.getElementById("voltage")!;
const currentElem = document.getElementById("current")!;
const powerElem = document.getElementById("power")!;
const powerFactorElem = document.getElementById("powerFactor")!;
const frequencyElem = document.getElementById("frequency")!;
const priceElem = document.getElementById("price")!;
const energyElem = document.getElementById("energy")!;
const capacityElem = document.getElementById("capacity")!;
const resistanceElem = document.getElementById("resistance")!;
const temperatureElem = document.getElementById("temperature")!;
const timeElem = document.getElementById("time")!;
const usbElem = document.getElementById("usb")!;

// Table stats
const voltageStatsElem = document.getElementById("voltage_stats")!;
const currentStatsElem = document.getElementById("current_stats")!;
const powerStatsElem = document.getElementById("power_stats")!;
const powerFactorStatsElem = document.getElementById("powerFactor_stats")!;
const frequencyStatsElem = document.getElementById("frequency_stats")!;
const priceStatsElem = document.getElementById("price_stats")!;
const energyStatsElem = document.getElementById("energy_stats")!;
const capacityStatsElem = document.getElementById("capacity_stats")!;
const resistanceStatsElem = document.getElementById("resistance_stats")!;
const temperatureStatsElem = document.getElementById("temperature_stats")!;
const timeStatsElem = document.getElementById("time_stats")!;
const usbStatsElem = document.getElementById("usb_stats")!;

// Row Display Options
// AC Rows
const rowPowerFactor = document.getElementById("row-powerFactor")!;
const rowFrequency = document.getElementById("row-frequency")!;
const rowPrice = document.getElementById("row-price")!;
// DC and USB Rows
const rowCapacity = document.getElementById("row-capacity")!;
const rowData = document.getElementById("row-data")!;

// Graph Display Options
const graphVisibility = document.getElementById("graph")!;
const graphDiv = 'graph';

// Colour Table
const colorConfig = {
    voltage: 'ffc000',
    current: 'fda456',
    power: 'ff4948',
    powerFactor: 'ff0a6f',
    resistance: '17642B',
    frequency: '33CA7F',
    energy: '9BE8B0',
    capacity: '17B890',
    price: '00A7E1',
    time: '84DCC6',
    temperature: '003459',
    data: '007EA7',
};

/* Functionality */
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface StateData {
    last_: Packet | null,
    history: Packet[],
    started: Date | null,
    stats: {
        min: {
            [key: string]: any
        };
        max: {
            [key: string]: any
        },
        average: {
            [key: string]: any
        },
    },
}

class state {
    private constructor() { }

    static meter = new Meter();
    static data_paused = false;
    static data: StateData = {} as StateData;
    static max_data = 60 * 60 * 12; // ~12 hour
    static device: BluetoothDevice | null = null;
    static reconnect = reconnectSwitch.checked;
    static data_saved = false;  // Add this line
    // Set measure duration
    static async setLength() {
        console.log("set length")
        // set max_data with cast int to string
        this.max_data = 60 * 60 * +lengthNumber.value;
    }

    // onDisconnectCallback
    static async stop(e: Event) {
        console.log("state stop");
        // set button state
        goButton.innerText = "Start";
        // restart with last know device
        if (state.device !== null && state.reconnect) {
            console.log("reconnecting to device with 2.5s delay");
            await sleep(2500);
            state.meter.start(state.device).catch(error => {
                console.error("port start error: ", error);
                showError(error);
            });
        }
    }

    // onStartCallback
    static async start(device: BluetoothDevice) {
        console.log("state start");
        this.reset();
        // set button state
        goButton.innerText = "Stop";
        this.data.started = new Date();
    }

    static reset() {
        this.last = null;
        this.data.history = [];
        this.data.stats = {
            min: {},
            max: {},
            average: {},
        };
    }

    // onPacketCallback
    static async add(p: Packet) {
        if (this.data_paused) {
            return;
        }

        if (!p) {
            console.error("got empty packet");
            return;
        }

        //console.log("new p:", p);
        this.data.history.unshift(p);
        if (this.data.history.length > this.max_data) {
            // trim data
            this.data.history.length = this.max_data;
        }

        this.updateStats(p);
        this.last = p;

        // AC/DC variables visability
        if (p.type == DEVICE_TYPE.AC) {
            // AC graph variable setting
            var data = [[p.voltage], [p.current], [p.power], [p.powerFactor], [p.energy], [p.resistance], [p.temp]];
            // Changing HTML Display Options
            titleDescription.innerText = windowDescription.innerText = "AC Power Meter";
            rowPowerFactor.classList.remove('hidden');
            rowFrequency.classList.remove('hidden');
            rowData.classList.add('hidden'); // rowPrice.classList.remove('hidden'); // Having trouble recieving price data
            rowPrice.classList.add('hidden');
            rowCapacity.classList.add('hidden');
            
            graphVisibility.classList.remove('hidden');
        }
        else if (p.type == DEVICE_TYPE.DC || p.type == DEVICE_TYPE.USB){
            // DC/USB graph variable setting
            var data = [[p.voltage], [p.current], [p.power], [p.powerFactor], [p.energy], [p.capacity], [p.resistance], [p.temp], [p.data1], [p.data2]];
            // Changing HTML Display Options
            titleDescription.innerText = windowDescription.innerText = "USB/DC Power Meter";
            rowCapacity.classList.remove('hidden');
            rowData.classList.remove('hidden');
            rowPowerFactor.classList.add('hidden');
            rowFrequency.classList.add('hidden');
            rowPrice.classList.add('hidden');
        }
        else {
            // Unknown device type graph variable setting
            var data = [[p.voltage], [p.current], [p.power], [p.powerFactor], [p.frequency], [p.energy], [p.capacity], [p.resistance], [p.temp], [p.data1], [p.data2]];
        };

        // Update the background color of the rows when some are hidden
        let rows = document.querySelectorAll('tr');
        let visibleRows = Array.from(rows).filter(row => !row.classList.contains('hidden'));
        visibleRows.forEach((row, index) => {
            if (index % 2 === 0) {
                row.style.backgroundColor = 'linen';  // Replace with the actual color for even rows
            } else {
                row.style.backgroundColor = 'floralwhite';  // Replace with the actual color for odd rows
            }
        });


        // Autosave if the sampling duration has ended
        if (this.data.history.length >= this.max_data && !this.data_saved) {
            Save();  // Call the Save function
            this.data_saved = true;  // Set the save flag to true
        }

        // Plot Graph
        Plotly.extendTraces(graphDiv, {
            y: data,
            x: new Array(data.length).fill([p.time]),
        }, Array.from(Array(data.length).keys()), this.max_data)
    }

    // TODO remove old values?
    static updateStats(p: Packet) {
        for (const prop in p) {
            //console.log("updating stats for", prop);
            if (typeof this.data.stats.max[prop] == 'undefined' || p[prop] > this.data.stats.max[prop]) {
                //console.log("new max", p[prop]);
                this.data.stats.max[prop] = p[prop];
            }
            if (typeof this.data.stats.min[prop] == 'undefined' || p[prop] < this.data.stats.min[prop]) {
                this.data.stats.min[prop] = p[prop];
                //console.log("new min", p[prop]);
            }
            if (typeof this.data.stats.average[prop] == 'undefined') {
                this.data.stats.average[prop] = 0;
                //console.log("resetting adv for", prop);
            }
            var oldAverage = this.data.stats.average[prop]
            if (Number.isFinite(oldAverage)) {
                var newAverage = oldAverage + (p[prop] - oldAverage) / this.data.history.length;
                this.data.stats.average[prop] = Math.round(newAverage * 100) / 100; // round to 2 decimal places
                //console.log("adv for", prop, this.data.stats.average[prop]);
            }
        }
    }

    static get last(): (Packet | null) {
        return this.data.last_;
    }

    static set last(p: Packet | null) {
        this.data.last_ = p;
        if (p) {
            // data
            voltageElem.innerText = `${p.voltage} V`;
            currentElem.innerText = `${p.current} A`;
            powerElem.innerText = `${p.power} W`;
            energyElem.innerText = `${p.energy} Wh`;
            capacityElem.innerText = `${p.capacity} mAh`;
            resistanceElem.innerText = `${p.resistance} Ω`;
            temperatureElem.innerText = `${p.temp} °C / ${cToF(p.temp)} °F`;
            usbElem.innerText = `${p.data1}/${p.data2} V`;
            timeElem.innerText = `${p.duration}`;
            
            // stats
            voltageStatsElem.innerText = `${this.data.stats.min.voltage} / ${this.data.stats.max.voltage} / ${this.data.stats.average.voltage}`;
            currentStatsElem.innerText = `${this.data.stats.min.current} / ${this.data.stats.max.current} / ${this.data.stats.average.current}`;
            powerStatsElem.innerText = `${this.data.stats.min.power} / ${this.data.stats.max.power} / ${this.data.stats.average.power}`;
            energyStatsElem.innerText = `${this.data.stats.min.energy} / ${this.data.stats.max.energy} / ${this.data.stats.average.energy}`;
            capacityStatsElem.innerText = `${this.data.stats.min.capacity} / ${this.data.stats.max.capacity} / ${this.data.stats.average.capacity}`;
            resistanceStatsElem.innerText = `${this.data.stats.min.resistance} / ${this.data.stats.max.resistance} / ${this.data.stats.average.resistance}`;
            temperatureStatsElem.innerText = `${this.data.stats.min.temp} / ${this.data.stats.max.temp} / ${this.data.stats.average.temp}`;
            usbStatsElem.innerText = `(${this.data.stats.min.data1}/${this.data.stats.min.data2}) / (${this.data.stats.max.data1}/${this.data.stats.max.data2}) / (${this.data.stats.average.data1}/${this.data.stats.average.data2})`;
            timeStatsElem.innerText = `Samples: ${this.data.history.length}`;
            
            // ac_check
            if (p.type == DEVICE_TYPE.AC) {
                // data
                powerFactorElem.innerText = `${p.powerFactor}`;
                frequencyElem.innerText = `${p.frequency} Hz`;
                priceElem.innerText = `${p.price} $/kWh`;
                // stats
                powerFactorStatsElem.innerText = `${this.data.stats.min.powerFactor} / ${this.data.stats.max.powerFactor} / ${this.data.stats.average.powerFactor}`;
                frequencyStatsElem.innerText = `${this.data.stats.min.frequency} / ${this.data.stats.max.frequency} / ${this.data.stats.average.frequency}`;
                priceStatsElem.innerText = `${this.data.stats.min.price} / ${this.data.stats.max.price} / ${this.data.stats.average.price}`;
            };
            
            if (p.type == DEVICE_TYPE.DC) {
                usbElem.innerText = 'N/A';
                usbStatsElem.innerText = 'N/A';
                energyElem.innerText = 'N/A';
                energyStatsElem.innerText = 'N/A';
            }
            // Add AC variable setting
        } else {
            console.log("clearing state");
            // data
            voltageElem.innerText = '';
            currentElem.innerText = '';
            powerElem.innerText = '';
            powerFactorElem.innerText = '';
            frequencyElem.innerText = '';
            priceElem.innerText = '';
            energyElem.innerText = '';
            capacityElem.innerText = '';
            resistanceElem.innerText = '';
            temperatureElem.innerText = '';
            usbElem.innerText = '';
            timeElem.innerText = '000:00:00';

            // stats
            voltageStatsElem.innerText = '';
            currentStatsElem.innerText = '';
            powerStatsElem.innerText = '';
            powerFactorStatsElem.innerText = '';
            frequencyStatsElem.innerText = '';
            priceStatsElem.innerText = '';
            energyStatsElem.innerText = '';
            capacityStatsElem.innerText = '';
            resistanceStatsElem.innerText = '';
            temperatureStatsElem.innerText = '';
            usbStatsElem.innerText = '';
            timeStatsElem.innerText = 'Samples: 0';
        }
    }
}

function showError(msg: string) {
    dialogMessageElem.innerText = msg;
    dialogElem.showModal();
}

// Add toggle option for this conversion
function cToF(cTemp: number): number {
    return cTemp * 9 / 5 + 32;
}

function Go() {
    if (state.meter.running) {
        console.log("stopping");
        state.meter.disconnect();
    } else {
        navigator.bluetooth.requestDevice({
            filters: [{
                services: [UUID_SERVICE]
            }]
        })
            .then(device => {
                state.device = device;
                goButton.innerText = "Starting....";
                console.log("got device: ", device.name, device.id);
                //console.log(device);
                state.meter.start(device).catch(error => {
                    console.error("port start error: ", error);
                    showError(error);
                });
            })
            .catch(error => {
                console.log("no port selected. event:", error);
            });
    }
}


function Pause() {
    state.data_paused = !state.data_paused;
    if (state.data_paused) {
        pauseElem.innerText = "Resume";
    } else {
        pauseElem.innerText = "Pause";
    }
}

function Reset() {
    console.log("reset");
    state.meter.reset();
    state.reset();
    initPlot();
}

// Add power factor and frequency variables
// Add AC checking and removal of DC variables
function initPlot() {
   
    // Plot Configuration
    const layout = {
        autosize: true,
        showlegend: true,
        automargin: true,
    };

    const config = {
        displaylogo: false,
        responsive: true,
    };

    // Trace Colour Configuration
    const traceConfig = [
        { name: "Volts", color: colorConfig.voltage },
        { name: "Current", color: colorConfig.current },
        { name: "Power", color: colorConfig.power },
        { name: "Power Factor", color: colorConfig.powerFactor },
        { name: "Energy", color: colorConfig.energy },
        { name: "Capacity", color: colorConfig.capacity },
        { name: "Resistance", color: colorConfig.resistance },
        { name: "Temperature", color: colorConfig.temperature },
        { name: "USB D-", color: colorConfig.data },
        { name: "USB D+", color: colorConfig.data },
    ];

    // Choose graph elements based on device type
    // DC graph variables
     if (DEVICE_TYPE.DC || DEVICE_TYPE.USB) {
        Plotly.newPlot(graphDiv, [{
            name: "Volts",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.voltage}` },
        },
        {
            name: "Current",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.current}` },
        },
        {
            name: "Power",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.power}` },
        },
        {
            name: "Energy",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.energy}` },
            visible: 'legendonly',
        },
        {
            name: "Capacity",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.capacity}` },
            visible: 'legendonly',
        },
        {
            name: "Resistance",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.resistance}` },
            visible: 'legendonly',
        },
        {
            name: "Temperature",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.temperature}` },
            visible: 'legendonly',
        },
        {
            name: "USB D-",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.data}` },
            visible: 'legendonly',
        },
        {
            name: "USB D+",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.data}` },
            visible: 'legendonly',
        },
        ], layout, config);
    };

    // AC graph variables
    if(DEVICE_TYPE.AC) {
        Plotly.newPlot(graphDiv, [{
            name: "Volts",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.voltage}` },
            visible: 'legendonly',
        },
        {
            name: "Current",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.current}` },
            visible: 'legendonly',
        },
        {
            name: "Power",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.power}` },
            // visible: 'legendonly',
        },
        {
            name: "Power Factor",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.powerFactor}` },
            visible: 'legendonly',
        },
        {
            name: "Energy",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.energy}` },
            visible: 'legendonly',
        },
        {
            name: "Resistance",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.resistance}` },
            visible: 'legendonly',
        },
        {
            name: "Temperature",
            y: [],
            x: [],
            mode: 'lines',
            line: { color: `#${colorConfig.temperature}` },
            visible: 'legendonly',
        },
        ], layout, config);
    };
}

document.addEventListener('DOMContentLoaded', async () => {

    // Checks if the "bluetooth" property exists in the navigator object. If it does, it hides the warnBlockElem element. 
    if ("bluetooth" in navigator) {
        warnBlockElem.hidden = true;
    } else {
        showError("WebBluetooth does not seem to be supported by this device");
    }

    // setup ui callbacks
    state.meter.onPacketCallback = state.add.bind(state);
    state.meter.onDisconnectCallback = state.stop.bind(state);
    state.meter.onStartCallback = state.start.bind(state);

    // Initialise graph
    initPlot();

    // Set Table Colours
    document.getElementById('row-voltage')?.style.setProperty('color', `#${colorConfig.voltage}`);
    document.getElementById('row-current')?.style.setProperty('color', `#${colorConfig.current}`);
    document.getElementById('row-power')?.style.setProperty('color', `#${colorConfig.power}`);
    document.getElementById('row-powerFactor')?.style.setProperty('color', `#${colorConfig.powerFactor}`);
    document.getElementById('row-frequency')?.style.setProperty('color', `#${colorConfig.frequency}`);
    document.getElementById('row-price')?.style.setProperty('color', `#${colorConfig.price}`);
    document.getElementById('row-energy')?.style.setProperty('color', `#${colorConfig.energy}`);
    document.getElementById('row-capacity')?.style.setProperty('color', `#${colorConfig.capacity}`);
    document.getElementById('row-resistance')?.style.setProperty('color', `#${colorConfig.resistance}`);
    document.getElementById('row-temperature')?.style.setProperty('color', `#${colorConfig.temperature}`);
    document.getElementById('row-data')?.style.setProperty('color', `#${colorConfig.data}`);
    document.getElementById('row-time')?.style.setProperty('color', `#${colorConfig.time}`);
});

function Save() {
    if (!state.last) {
        // no data
        showError("No data yet");
        return;
    }
    const csv_columns: Array<string> = ["time", "voltage", "current", "power", "powerFactor", "frequency", "resistance", "capacity", "energy", "data1", "data2", "temp", "duration"];
    // const csv_columns: Array<string> = ["time", "voltage", "current", "power", "resistance", "capacity", "energy", "data1", "data2", "temp", "duration",];
    
    // File Naming
    const filenameInput = document.getElementById('filename') as HTMLInputElement;
    let filename: string = filenameInput.value || "data";
    filename = filename.replace(/[<>:"/\\|?*]+/g, ''); // Remove illegal characters from filename
    if (!filename.endsWith('.csv')) { // Append .csv if not already there
        filename += '.csv';
    }   

    var headers: Array<string> = [];

    let csvContent = "data:text/csv;charset=utf-8,";

    // write header
    for (var i = 0; i < csv_columns.length; i++) {
        if (state.last[csv_columns[i]]) {
            headers.push(csv_columns[i]);
        }
    }
    csvContent += headers.join(",") + "\r\n";

    // write data
    state.data.history.forEach(function (p) {
        for (const i in headers) {
            var h = headers[i];
            console.log("cav add: ", h, p[h], p);
            csvContent += p[h] + ",";
        }
        csvContent += "\r\n";
    });

    console.log("all csv", csvContent);

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for FF

    link.click(); // This will download the data file
    link.remove();
}

function setLength() {
    if (state.meter.running) {
        console.log("Pause or stop to make measurement durations");
        return;
    }
    state.setLength()
}

function setReconnect() {
    console.log("set reconnect");
    state.reconnect = reconnectSwitch.checked;
}
