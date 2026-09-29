import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Path, Rect } from 'react-native-svg';

import { BarChart } from '../BarChart';
import { FitGrid } from '../FitGrid';
import { Heatmap } from '../Heatmap';
import { MonthCalendar } from '../MonthCalendar';
import { TimePickerModal } from '../TimePickerModal';

beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 8, 25, 12) })); // viernes 25/9/2026
afterAll(() => jest.useRealTimers());

const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } });

describe('<MonthCalendar />', () => {
  const setup = (counts: Record<string, number> = {}, target = 1) => {
    const onPressDay = jest.fn();
    const onLongPressDay = jest.fn();
    render(
      <MonthCalendar
        counts={counts}
        color="#39D353"
        target={target}
        isScheduled={() => true}
        onPressDay={onPressDay}
        onLongPressDay={onLongPressDay}
      />,
    );
    return { onPressDay, onLongPressDay };
  };

  it('muestra el mes actual y no deja avanzar al futuro', () => {
    setup();
    expect(screen.getByText('Septiembre de 2026')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(screen.getByText('Septiembre de 2026')).toBeTruthy();
  });

  it('navega a meses anteriores y vuelve', () => {
    setup();
    fireEvent.press(screen.getByLabelText('Mes anterior'));
    expect(screen.getByText('Agosto de 2026')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Mes anterior'));
    expect(screen.getByText('Julio de 2026')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(screen.getByText('Agosto de 2026')).toBeTruthy();
  });

  it('tocar y mantener pulsado un día avisan con su fecha', () => {
    const { onPressDay, onLongPressDay } = setup();
    fireEvent.press(screen.getByLabelText('2026-09-10'));
    fireEvent(screen.getByLabelText('2026-09-11'), 'longPress');
    expect(onPressDay).toHaveBeenCalledWith('2026-09-10');
    expect(onLongPressDay).toHaveBeenCalledWith('2026-09-11');
  });

  it('los días futuros no se pueden tocar', () => {
    const { onPressDay } = setup();
    fireEvent.press(screen.getByLabelText('2026-09-26'));
    expect(onPressDay).not.toHaveBeenCalled();
  });

  it('en metas de varias veces muestra el progreso del día', () => {
    setup({ '2026-09-24': 3, '2026-09-23': 8 }, 8);
    expect(screen.getByText('3/8')).toBeTruthy();
    expect(screen.getByLabelText('2026-09-24, 3 veces')).toBeTruthy();
    expect(screen.queryByText('8/8')).toBeNull(); // completo: sin contador
  });
});

describe('<BarChart />', () => {
  it('describe cada barra y marca las que no tienen datos', () => {
    render(<BarChart color="#39D353" bars={[{ label: 'L', value: 80 }, { label: 'M', value: null }, { label: 'X', value: 0 }]} />);
    expect(screen.getByLabelText('L: 80 %')).toBeTruthy();
    expect(screen.getByLabelText('M: sin datos')).toBeTruthy();
    expect(screen.getByLabelText('X: 0 %')).toBeTruthy();
  });

  it('con labelEvery solo etiqueta algunas barras, pero siempre la actual', () => {
    const bars = Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: 50, current: i === 6 }));
    render(<BarChart color="#39D353" bars={bars} labelEvery={5} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy(); // actual
    expect(screen.queryByText('2')).toBeNull();
  });
});

describe('<FitGrid />', () => {
  const items = Array.from({ length: 20 }, (_, i) => `i${i}`);
  const renderGrid = (props: Partial<Parameters<typeof FitGrid<string>>[0]> = {}) =>
    render(
      <FitGrid items={items} minItemSize={48} gap={10} keyOf={(i) => i} renderItem={(i, size) => <Text>{`${i}:${Math.round(size)}`}</Text>} {...props} />,
    );

  it('no pinta nada hasta conocer el ancho', () => {
    renderGrid();
    expect(screen.queryByText(/^i0:/)).toBeNull();
  });

  it('calcula columnas y agranda los elementos para llenar la fila', () => {
    renderGrid();
    fireEvent(screen.root, 'layout', layout(358));
    // 358 px con mínimo 48 y hueco 10 → 6 columnas de (358 - 50) / 6 ≈ 51 px.
    expect(screen.getByText('i0:51')).toBeTruthy();
  });

  it('maxRows limita a filas completas y columns fija el número de columnas', () => {
    renderGrid({ maxRows: 2 });
    fireEvent(screen.root, 'layout', layout(358));
    expect(screen.getAllByText(/^i\d+:/)).toHaveLength(12);

    screen.unmount();
    renderGrid({ columns: 4 });
    fireEvent(screen.root, 'layout', layout(358));
    expect(screen.getByText('i0:82')).toBeTruthy(); // (358 - 30) / 4
  });
});

describe('<TimePickerModal />', () => {
  const setup = (initial: string) => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<TimePickerModal visible initial={initial} color="#39D353" onConfirm={onConfirm} onCancel={onCancel} />);
    return { onConfirm, onCancel };
  };

  it('parte de la hora inicial redondeada a 5 minutos', () => {
    const { onConfirm } = setup('08:07');
    expect(screen.getByText('08:05')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar hora'));
    expect(onConfirm).toHaveBeenCalledWith('08:05');
  });

  it('elegir hora y minuto, o usar un atajo', () => {
    const { onConfirm } = setup('08:00');
    fireEvent.press(screen.getByLabelText('Hora 19'));
    fireEvent.press(screen.getByLabelText('Minuto 45'));
    fireEvent.press(screen.getByText('Guardar hora'));
    expect(onConfirm).toHaveBeenLastCalledWith('19:45');
    fireEvent.press(screen.getByText('21:00'));
    fireEvent.press(screen.getByText('Guardar hora'));
    expect(onConfirm).toHaveBeenLastCalledWith('21:00');
  });

  it('cancelar no guarda nada', () => {
    const { onConfirm, onCancel } = setup('08:00');
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cerrado no muestra nada', () => {
    render(<TimePickerModal visible={false} initial="08:00" color="#39D353" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('Guardar hora')).toBeNull();
  });
});

describe('<Heatmap /> ajustado al ancho', () => {
  it('no dibuja hasta medir y dibuja un trazado por color al medir', () => {
    const counts = { '2026-09-24': 1, '2026-09-23': 1 };
    render(<Heatmap counts={counts} color="#39D353" />);
    expect(screen.UNSAFE_queryAllByType(Path)).toHaveLength(0);
    fireEvent(screen.root, 'layout', layout(320));
    const fills = screen.UNSAFE_getAllByType(Path).map((p) => p.props.fill);
    // Hechos (color lleno) y vacíos (color con alfa): pocos trazados, no uno por celda.
    expect(fills).toContain('#39D353');
    expect(fills.length).toBeLessThanOrEqual(4);
    expect(screen.UNSAFE_getAllByType(Rect)).toHaveLength(1); // contorno de hoy
  });

  it('un ancho 0 (vista oculta) no borra el dibujo', () => {
    render(<Heatmap counts={{}} color="#39D353" />);
    fireEvent(screen.root, 'layout', layout(320));
    const before = screen.UNSAFE_getAllByType(Path).length;
    fireEvent(screen.root, 'layout', layout(0));
    expect(screen.UNSAFE_getAllByType(Path)).toHaveLength(before);
  });

  it('terminando en otra fecha no marca el día de hoy', () => {
    render(<Heatmap counts={{}} color="#39D353" weeks={5} endKey="2025-12-31" />);
    expect(screen.UNSAFE_queryAllByType(Rect)).toHaveLength(0);
  });
});
