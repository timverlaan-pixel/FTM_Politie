// Follow the Money Official Brand Colors (Brand Manual V1 - December 2024)
const colors = {
    primary: '#FF5725',      // FTM Rood (main brand color)
    secondary: '#706F5F',    // Dollargroen
    tertiary: '#A49B93',     // Zilver
    accent: '#B48559',       // Goud
    dark: '#000000',         // Zwart
    offwhite: '#F5F1ED',     // Offwhite
    // Supplementary colors (if needed)
    duifgrijs: '#204951',    // Dove grey
    bruinrood: '#B43C09',    // Brown-red
    blauw: '#0068AF'         // Blue
};

// Parse Euro values from CSV
function parseEuro(str) {
    if (!str || str === '') return null;
    return parseFloat(str.replace('€', '').replace(/\./g, '').replace(',', '.'));
}

// Parse percentage values from CSV
function parsePercent(str) {
    if (!str || str === '') return null;
    return parseFloat(str.replace(',', '.'));
}

// Format numbers as millions
function formatMillions(value) {
    return `€${(value / 1000).toFixed(1)}mrd`;
}

// Format percentages
function formatPercent(value) {
    return `${value.toFixed(1)}%`;
}

// Global data stores
let begrotingData = [];
let misdrijvenData = [];
let ophelderingData = [];

// Load all data
Promise.all([
    d3.csv('Begroting.csv'),
    d3.csv('Misdrijven.csv'),
    d3.csv('Ophelderingspercentage.csv')
]).then(([begroting, misdrijven, opheldering]) => {
    // Process budget data
    begrotingData = begroting.map(d => ({
        jaar: +d.Jaar,
        begroting: parseEuro(d.Begroting),
        realisatie: parseEuro(d.Realisatie),
        inflatie: parseEuro(d['Inflatie * Begroting2015'])
    }));

    // Process crime data
    misdrijvenData = misdrijven.map(d => ({
        jaar: +d.Perioden,
        totaal: +d.Totaal,
        geweld: +d.Geweldsmisdrijven,
        vermogen: +d.Vermogensmisdrijven,
        vernieling: +d.Vernielingen
    }));

    // Process clearance rate data
    ophelderingData = opheldering.map(d => ({
        jaar: +d.Perioden,
        totaal: parsePercent(d.Totaal),
        vermogen: parsePercent(d['Vermogens-']),
        geweld: parsePercent(d['Gewelds-'])
    }));

    // Initialize charts
    initBezuinigingenChart();
    initCriminaliteitChart();
    initOphelderingChart();

    // Initialize scrollytelling
    initScrollytelling();
});

// Chart 1: Budget (Bezuinigingen)
function initBezuinigingenChart() {
    const container = d3.select('#chart-bezuinigingen');
    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(begrotingData, d => d.jaar))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([5000000, d3.max(begrotingData, d => Math.max(d.begroting, d.realisatie)) * 1.05])
        .range([height, 0]);

    // Grid
    const grid = svg.append('g')
        .attr('class', 'grid')
        .style('opacity', 0)
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat('')
        );

    // Axes
    const xAxis = svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .style('opacity', 0)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    const yAxis = svg.append('g')
        .attr('class', 'axis')
        .style('opacity', 0)
        .call(d3.axisLeft(y).tickFormat(d => formatMillions(d)));

    // Line generators
    const lineInflatie = d3.line()
        .defined(d => d.inflatie !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.inflatie))
        .curve(d3.curveMonotoneX);

    const lineBegroting = d3.line()
        .defined(d => d.begroting !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.begroting))
        .curve(d3.curveMonotoneX);

    const lineRealisatie = d3.line()
        .defined(d => d.realisatie !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.realisatie))
        .curve(d3.curveMonotoneX);

    // Area generator for shading between begroting and inflatie
    const areaBetween = d3.area()
        .defined(d => d.begroting !== null && d.inflatie !== null)
        .x(d => x(d.jaar))
        .y0(d => y(d.inflatie))
        .y1(d => y(d.begroting))
        .curve(d3.curveMonotoneX);

    // Draw shaded area (hidden initially)
    const shadedArea = svg.append('g').attr('class', 'shaded-area-group').style('opacity', 0);
    shadedArea.append('path')
        .datum(begrotingData)
        .attr('class', 'shaded-area')
        .attr('d', areaBetween)
        .attr('fill', colors.primary)
        .attr('opacity', 0.2);

    // Add annotation text in the middle of the shaded area
    const midYear = 2020;
    const midData = begrotingData.find(d => d.jaar === midYear);
    const annotationGroup = svg.append('g').attr('class', 'annotation-group').style('opacity', 0);

    if (midData) {
        const midY = (y(midData.begroting) + y(midData.inflatie)) / 2;

        annotationGroup.append('text')
            .attr('x', x(midYear))
            .attr('y', midY)
            .attr('text-anchor', 'middle')
            .attr('class', 'area-annotation')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .attr('fill', colors.primary)
            .text('€9,5 mrd extra');
    }

    // Draw lines with stroke colors
    const inflatieGroup = svg.append('g').attr('class', 'line-group-inflatie').style('opacity', 0);
    inflatieGroup.append('path')
        .datum(begrotingData)
        .attr('class', 'line line-inflatie')
        .attr('d', lineInflatie)
        .attr('stroke', colors.tertiary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const begrotingGroup = svg.append('g').attr('class', 'line-group-begroting').style('opacity', 0);
    begrotingGroup.append('path')
        .datum(begrotingData)
        .attr('class', 'line line-begroting')
        .attr('d', lineBegroting)
        .attr('stroke', colors.primary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const realisatieGroup = svg.append('g').attr('class', 'line-group-realisatie').style('opacity', 0);
    realisatieGroup.append('path')
        .datum(begrotingData)
        .attr('class', 'line line-realisatie')
        .attr('d', lineRealisatie)
        .attr('stroke', colors.secondary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    // Add end labels for each line
    const begrotingLabel = begrotingGroup.append('g').attr('class', 'end-label');
    const lastBegrotingData = begrotingData[begrotingData.length - 2]; // 2025 (second to last)
    begrotingLabel.append('text')
        .attr('x', x(lastBegrotingData.jaar) + 5)
        .attr('y', y(lastBegrotingData.begroting))
        .attr('dy', '0.35em')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', colors.primary)
        .text(formatMillions(lastBegrotingData.begroting));

    const inflatieLabel = inflatieGroup.append('g').attr('class', 'end-label');
    const lastInflatieData = begrotingData[begrotingData.length - 2];
    inflatieLabel.append('text')
        .attr('x', x(lastInflatieData.jaar) + 5)
        .attr('y', y(lastInflatieData.inflatie))
        .attr('dy', '0.35em')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', colors.tertiary)
        .text(formatMillions(lastInflatieData.inflatie));

    const realisatieLabel = realisatieGroup.append('g').attr('class', 'end-label');
    const lastRealisatieData = begrotingData.filter(d => d.realisatie !== null);
    const lastRealisatie = lastRealisatieData[lastRealisatieData.length - 1];
    realisatieLabel.append('text')
        .attr('x', x(lastRealisatie.jaar) + 5)
        .attr('y', y(lastRealisatie.realisatie))
        .attr('dy', '0.35em')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', colors.tertiary)
        .text(formatMillions(lastRealisatie.realisatie));

    // Legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 20}, 20)`);

    const legendData = [
        { label: 'Begroting', class: 'line-begroting', color: colors.primary },
        { label: 'Realisatie', class: 'line-realisatie', color: colors.tertiary },
        { label: 'Inflatie (2015)', class: 'line-inflatie', color: colors.tertiary }
    ];

    legendData.forEach((item, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('opacity', 0)
            .attr('class', `legend-${item.class}`);

        g.append('line')
            .attr('x1', 0)
            .attr('x2', 30)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', item.color)
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', item.class === 'line-inflatie' ? '5,5' : '0');

        g.append('text')
            .attr('x', 40)
            .attr('y', 5)
            .text(item.label)
            .attr('class', 'legend-text');
    });

    // Store references for animation
    container.node().chartData = {
        begrotingGroup,
        realisatieGroup,
        inflatieGroup,
        shadedArea,
        annotationGroup,
        legend,
        grid,
        xAxis,
        yAxis,
        x,
        y
    };
}

// Chart 2: Crime (Criminaliteit)
function initCriminaliteitChart() {
    const container = d3.select('#chart-criminaliteit');
    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(misdrijvenData, d => d.jaar))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(misdrijvenData, d => d.totaal) * 1.1])
        .range([height, 0]);

    // Grid
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat('')
        );

    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).tickFormat(d => (d / 1000).toFixed(0) + 'k'));

    // Line generators
    const lineTotaal = d3.line()
        .x(d => x(d.jaar))
        .y(d => y(d.totaal))
        .curve(d3.curveMonotoneX);

    const lineGeweld = d3.line()
        .x(d => x(d.jaar))
        .y(d => y(d.geweld))
        .curve(d3.curveMonotoneX);

    const lineVermogen = d3.line()
        .x(d => x(d.jaar))
        .y(d => y(d.vermogen))
        .curve(d3.curveMonotoneX);

    // Draw lines with stroke colors
    const totaalGroup = svg.append('g').attr('class', 'line-group-totaal').style('opacity', 0);
    totaalGroup.append('path')
        .datum(misdrijvenData)
        .attr('class', 'line line-totaal')
        .attr('d', lineTotaal)
        .attr('stroke', colors.dark)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const geweldGroup = svg.append('g').attr('class', 'line-group-geweld').style('opacity', 0);
    geweldGroup.append('path')
        .datum(misdrijvenData)
        .attr('class', 'line line-geweld')
        .attr('d', lineGeweld)
        .attr('stroke', colors.tertiary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const vermogenGroup = svg.append('g').attr('class', 'line-group-vermogen').style('opacity', 0);
    vermogenGroup.append('path')
        .datum(misdrijvenData)
        .attr('class', 'line line-vermogen')
        .attr('d', lineVermogen)
        .attr('stroke', colors.primary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    // Legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 20}, 20)`);

    const legendData = [
        { label: 'Totaal', class: 'totaal', color: colors.dark },
        { label: 'Geweld', class: 'geweld', color: colors.tertiary },
        { label: 'Vermogen', class: 'vermogen', color: colors.primary }
    ];

    legendData.forEach((item, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('opacity', 0)
            .attr('class', `legend-${item.class}`);

        g.append('line')
            .attr('x1', 0)
            .attr('x2', 30)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', item.color)
            .attr('stroke-width', 3);

        g.append('text')
            .attr('x', 40)
            .attr('y', 5)
            .text(item.label)
            .attr('class', 'legend-text');
    });

    container.node().chartData = {
        totaalGroup,
        geweldGroup,
        vermogenGroup,
        legend
    };
}

// Chart 3: Clearance Rate (Opheldering)
function initOphelderingChart() {
    const container = d3.select('#chart-opheldering');
    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(ophelderingData, d => d.jaar))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(ophelderingData, d => Math.max(d.totaal, d.vermogen, d.geweld)) * 1.2])
        .range([height, 0]);

    // Grid
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat('')
        );

    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).tickFormat(d => d.toFixed(0) + '%'));

    // Line generators
    const lineTotaal = d3.line()
        .defined(d => d.totaal !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.totaal))
        .curve(d3.curveMonotoneX);

    const lineVermogen = d3.line()
        .defined(d => d.vermogen !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.vermogen))
        .curve(d3.curveMonotoneX);

    const lineGeweld = d3.line()
        .defined(d => d.geweld !== null)
        .x(d => x(d.jaar))
        .y(d => y(d.geweld))
        .curve(d3.curveMonotoneX);

    // Draw lines with stroke colors
    const totaalGroup = svg.append('g').attr('class', 'line-group-totaal').style('opacity', 0);
    totaalGroup.append('path')
        .datum(ophelderingData)
        .attr('class', 'line line-totaal-opheldering')
        .attr('d', lineTotaal)
        .attr('stroke', colors.dark)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const vermogenGroup = svg.append('g').attr('class', 'line-group-vermogen').style('opacity', 0);
    vermogenGroup.append('path')
        .datum(ophelderingData)
        .attr('class', 'line line-vermogen-opheldering')
        .attr('d', lineVermogen)
        .attr('stroke', colors.primary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    const geweldGroup = svg.append('g').attr('class', 'line-group-geweld').style('opacity', 0);
    geweldGroup.append('path')
        .datum(ophelderingData)
        .attr('class', 'line line-geweld-opheldering')
        .attr('d', lineGeweld)
        .attr('stroke', colors.tertiary)
        .attr('stroke-width', 3)
        .attr('fill', 'none');

    // Legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 20}, 20)`);

    const legendData = [
        { label: 'Totaal', class: 'totaal', color: colors.secondary },
        { label: 'Vermogen', class: 'vermogen', color: colors.primary },
        { label: 'Geweld', class: 'geweld', color: colors.tertiary }
    ];

    legendData.forEach((item, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('opacity', 0)
            .attr('class', `legend-${item.class}`);

        g.append('line')
            .attr('x1', 0)
            .attr('x2', 30)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', item.color)
            .attr('stroke-width', 3);

        g.append('text')
            .attr('x', 40)
            .attr('y', 5)
            .text(item.label)
            .attr('class', 'legend-text');
    });

    container.node().chartData = {
        totaalGroup,
        vermogenGroup,
        geweldGroup,
        legend
    };
}

// Initialize scrollytelling with Scrollama
function initScrollytelling() {
    // Bezuinigingen scrollytelling (with text-step class)
    const scrollerBezuinigingen = scrollama();
    scrollerBezuinigingen
        .setup({
            step: '#scrolly-bezuinigingen .text-step',
            offset: 0.7,
            debug: false
        })
        .onStepEnter(handleBezuinigingenStep)
        .onStepExit(response => {
            response.element.classList.remove('active');
        });

    // Criminaliteit scrollytelling
    const scrollerCriminaliteit = scrollama();
    scrollerCriminaliteit
        .setup({
            step: '#scrolly-criminaliteit .text-step',
            offset: 0.7,
            debug: false
        })
        .onStepEnter(handleCriminaliteitStep)
        .onStepExit(response => {
            response.element.classList.remove('active');
        });

    // Opheldering scrollytelling
    const scrollerOpheldering = scrollama();
    scrollerOpheldering
        .setup({
            step: '#scrolly-opheldering .text-step',
            offset: 0.7,
            debug: false
        })
        .onStepEnter(handleOphelderingStep)
        .onStepExit(response => {
            response.element.classList.remove('active');
        });

    // Handle window resize
    window.addEventListener('resize', () => {
        scrollerBezuinigingen.resize();
        scrollerCriminaliteit.resize();
        scrollerOpheldering.resize();
    });
}

// Handle budget chart steps
function handleBezuinigingenStep(response) {
    const step = +response.element.dataset.step;
    response.element.classList.add('active');

    const container = d3.select('#chart-bezuinigingen');
    const data = container.node().chartData;

    if (!data) return;

    switch (step) {
        case 0:
            // Title - no chart yet
            data.grid.transition().duration(800).style('opacity', 0);
            data.xAxis.transition().duration(800).style('opacity', 0);
            data.yAxis.transition().duration(800).style('opacity', 0);
            data.begrotingGroup.transition().duration(800).style('opacity', 0);
            data.realisatieGroup.transition().duration(800).style('opacity', 0);
            data.inflatieGroup.transition().duration(800).style('opacity', 0);
            data.shadedArea.transition().duration(800).style('opacity', 0);
            data.annotationGroup.transition().duration(800).style('opacity', 0);
            d3.selectAll('.legend-line-begroting, .legend-line-realisatie, .legend-line-inflatie')
                .transition().duration(800).style('opacity', 0);
            break;
        case 1:
            // Intro text - still no chart
            break;
        case 2:
            // Show chart axes and begroting line - "was in 2015 nog € 5,1 miljard"
            data.grid.transition().duration(1000).style('opacity', 1);
            data.xAxis.transition().duration(1000).style('opacity', 1);
            data.yAxis.transition().duration(1000).style('opacity', 1);
            data.begrotingGroup.transition().duration(1000).style('opacity', 1);
            d3.select('.legend-line-begroting').transition().duration(1000).style('opacity', 1);
            break;
        case 3:
            // Keep begroting, show how it grew to 2025
            // Already visible from previous step
            break;
        case 4:
            // Show inflation line - "als alleen meegegroeid met inflatie"
            data.inflatieGroup.transition().duration(1000).style('opacity', 1);
            d3.select('.legend-line-inflatie').transition().duration(1000).style('opacity', 1);
            break;
        case 5:
            // Show shaded area and annotation - "€ 1,5 miljard extra"
            data.shadedArea.transition().duration(1000).style('opacity', 1);
            data.annotationGroup.transition().duration(1000).style('opacity', 1);
            break;
        case 6:
            // Show realisatie line - "structureel overschreden"
            data.realisatieGroup.transition().duration(1000).style('opacity', 1);
            d3.select('.legend-line-realisatie').transition().duration(1000).style('opacity', 1);
            break;
    }
}

// Handle crime chart steps
function handleCriminaliteitStep(response) {
    const step = +response.element.dataset.step;
    response.element.classList.add('active');

    const container = d3.select('#chart-criminaliteit');
    const data = container.node().chartData;

    if (!data) return;

    switch (step) {
        case 0:
            // Initial state
            data.totaalGroup.transition().duration(800).style('opacity', 0);
            data.geweldGroup.transition().duration(800).style('opacity', 0);
            data.vermogenGroup.transition().duration(800).style('opacity', 0);
            d3.selectAll('.legend-totaal, .legend-geweld, .legend-vermogen')
                .transition().duration(800).style('opacity', 0);
            break;
        case 1:
            // Show total crimes
            data.totaalGroup.transition().duration(800).style('opacity', 1);
            d3.select('.legend-totaal').transition().duration(800).style('opacity', 1);
            break;
        case 2:
            // Show violent crimes
            data.geweldGroup.transition().duration(800).style('opacity', 1);
            d3.select('.legend-geweld').transition().duration(800).style('opacity', 1);
            break;
        case 3:
            // Show property crimes
            data.vermogenGroup.transition().duration(800).style('opacity', 1);
            d3.select('.legend-vermogen').transition().duration(800).style('opacity', 1);
            break;
        case 4:
            // Keep all visible
            break;
    }
}

// Handle clearance rate chart steps
function handleOphelderingStep(response) {
    const step = +response.element.dataset.step;
    response.element.classList.add('active');

    const container = d3.select('#chart-opheldering');
    const data = container.node().chartData;

    if (!data) return;

    switch (step) {
        case 0:
            // Initial state
            data.totaalGroup.transition().duration(800).style('opacity', 0);
            data.geweldGroup.transition().duration(800).style('opacity', 0);
            data.vermogenGroup.transition().duration(800).style('opacity', 0);
            d3.selectAll('.legend-totaal, .legend-geweld, .legend-vermogen')
                .transition().duration(800).style('opacity', 0);
            break;
        case 1:
            // Show all lines
            data.totaalGroup.transition().duration(800).style('opacity', 1);
            data.geweldGroup.transition().duration(800).style('opacity', 1);
            data.vermogenGroup.transition().duration(800).style('opacity', 1);
            d3.selectAll('.legend-totaal, .legend-geweld, .legend-vermogen')
                .transition().duration(800).style('opacity', 1);
            break;
        case 2:
            // Highlight property crimes clearance
            data.totaalGroup.transition().duration(800).style('opacity', 0.3);
            data.geweldGroup.transition().duration(800).style('opacity', 0.3);
            data.vermogenGroup.transition().duration(800).style('opacity', 1);
            break;
    }
}
