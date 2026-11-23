"""Parametric reconstruction of the UT PCB coupon and a separate handling nest.

Coupon interfaces: 20 × 15 mm outline from M.Eng. report Fig. 3(d).
Construction assumptions: 1.60 mm PCB, 35 µm copper, 3.50 mm overlap,
0.10 mm ECA bondline. Trace detail and bridge hardware are illustrative.
The handling nest is a CNC-milling concept for insulating acetal.
It is a bench locating aid for the modeled PCB coupon.
"""
from pathlib import Path

from build123d import Align, Box, Color, Compound, Cylinder, Location, export_step, import_step

BOARD_L_MM = 20
BOARD_W_MM = 15
BOARD_T_MM = 1.60
COPPER_T_MM = 0.035
OVERLAP_MM = 3.50
BOND_T_MM = 0.10
BOND_W_MM = 12.20
NEST_L_MM = 52
NEST_W_MM = 26
NEST_H_MM = 9
LOWER_SEAT_MM = 3.20
SIDE_CLEAR_MM = 0.25
END_CLEAR_MM = 0.20
WINDOW_L_MM = 9.60
WINDOW_W_MM = 16.50
MOUNT_X_MM = 13
MOUNT_Y_MM = 10.50
MOUNT_D_MM = 2.80
BRIDGE_L_MM = 6.0
BRIDGE_T_MM = 2.5
PAD_CLEAR_MM = 0.30

BOARD_COLOR = (0.12, 0.46, 0.40)
COPPER_COLOR = (0.85, 0.48, 0.20)
BOND_COLOR = (0.66, 0.73, 0.74)
NEST_COLOR = (0.36, 0.48, 0.62)
BRIDGE_COLOR = (0.61, 0.70, 0.78)


def box(dx, dy, dz, x=0, y=0, z=0):
    return Box(dx, dy, dz, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(
        Location((x, y, z))
    )


def label(shape, name, rgb):
    shape.label = name
    shape.color = Color(*rgb)
    return shape


def coupon(lift_mm=0):
    offset = (BOARD_L_MM - OVERLAP_MM) / 2
    left = box(BOARD_L_MM, BOARD_W_MM, BOARD_T_MM, -offset)
    right_z = BOARD_T_MM + 2 * COPPER_T_MM + BOND_T_MM
    right = box(BOARD_L_MM, BOARD_W_MM, BOARD_T_MM, offset, z=right_z + lift_mm)
    current = box(4.7, 10.0, COPPER_T_MM, -offset - 5.5, -0.45, BOARD_T_MM)
    current = current.fuse(box(14.3, 0.9, COPPER_T_MM, -offset + 2.85, -5.0, BOARD_T_MM))
    sense = box(1.8, 2.5, COPPER_T_MM, -offset - 1.5, -2.25, BOARD_T_MM)
    sense = sense.fuse(box(11.8, 0.65, COPPER_T_MM, -offset + 4.1, -3.15, BOARD_T_MM))
    mirror = Location((0, 0, BOND_T_MM + COPPER_T_MM + lift_mm), (0, 0, 180))
    right_current = current.moved(mirror)
    right_sense = sense.moved(mirror)
    bond = box(OVERLAP_MM, BOND_W_MM, BOND_T_MM, z=BOARD_T_MM + COPPER_T_MM)
    return [
        label(left, "Lower PCB", BOARD_COLOR),
        label(right, "Upper PCB", BOARD_COLOR),
        label(current, "Lower current pad and trace", COPPER_COLOR),
        label(sense, "Lower voltage sense pad and trace", COPPER_COLOR),
        label(right_current, "Upper current pad and trace", COPPER_COLOR),
        label(right_sense, "Upper voltage sense pad and trace", COPPER_COLOR),
        label(bond, "Conductive adhesive layer", BOND_COLOR),
    ]


def bore(x, y, z, height):
    return Cylinder(MOUNT_D_MM / 2, height,
                    align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((x, y, z)))


def nest_body():
    pocket_length = 2 * BOARD_L_MM - OVERLAP_MM + 2 * END_CLEAR_MM
    pocket_width = BOARD_W_MM + 2 * SIDE_CLEAR_MM
    upper_seat = LOWER_SEAT_MM + BOARD_T_MM + COPPER_T_MM + BOND_T_MM
    base = box(NEST_L_MM, NEST_W_MM, NEST_H_MM)
    for x, floor in [(-pocket_length / 4, LOWER_SEAT_MM),
                     (pocket_length / 4, upper_seat)]:
        base = base.cut(box(pocket_length / 2, pocket_width, NEST_H_MM + 1, x, z=floor))
    base = base.cut(box(WINDOW_L_MM, WINDOW_W_MM, NEST_H_MM + 2, z=-1))
    # Through reliefs let a cutter leave radius at the stepped seat and its end stops.
    cutter_r = 1.5
    for x in [-pocket_length / 2, pocket_length / 2]:
        for y in [-pocket_width / 2, pocket_width / 2]:
            relief = Cylinder(cutter_r, NEST_H_MM + 1,
                              align=(Align.CENTER, Align.CENTER, Align.MIN))
            base = base.cut(relief.moved(Location((x, y, LOWER_SEAT_MM))))
    for x in [-MOUNT_X_MM, MOUNT_X_MM]:
        for y in [-MOUNT_Y_MM, MOUNT_Y_MM]:
            base = base.cut(bore(x, y, -1, NEST_H_MM + 2))
    return label(base, "Stepped nest base", NEST_COLOR)


def bridge(x, rise=0):
    lower = LOWER_SEAT_MM + BOARD_T_MM + COPPER_T_MM
    upper = LOWER_SEAT_MM + 2 * BOARD_T_MM + 2 * COPPER_T_MM + BOND_T_MM
    pad_z = (lower if x < 0 else upper) + PAD_CLEAR_MM
    bar = box(BRIDGE_L_MM, NEST_W_MM - 2, BRIDGE_T_MM, x, z=NEST_H_MM)
    pad = box(BRIDGE_L_MM, BOARD_W_MM - 3, NEST_H_MM - pad_z, x, z=pad_z)
    bar = bar.fuse(pad)
    for y in [-MOUNT_Y_MM, MOUNT_Y_MM]:
        bar = bar.cut(bore(x, y, NEST_H_MM - 1, BRIDGE_T_MM + 2))
    return label(bar.moved(Location((0, 0, rise))), "Removable keeper", BRIDGE_COLOR)


def build():
    return nest_body()


def interfaces():
    # The coupon dimensions come from the project report.
    return []


def checks():
    return [
        {"kind": "clear", "label": "Access through center", "shape": box(9, 15, 9)},
        {"kind": "clear", "label": "Lower PCB envelope",
         "shape": box(11.5, BOARD_W_MM, BOARD_T_MM, -12, z=LOWER_SEAT_MM)},
        {"kind": "clear", "label": "Upper PCB envelope",
         "shape": box(11.5, BOARD_W_MM, BOARD_T_MM, 12,
                      z=LOWER_SEAT_MM + BOARD_T_MM + 2 * COPPER_T_MM + BOND_T_MM)},
    ]


def fixture(exploded=False):
    rise = 7 if exploded else 0
    specimen = [part.moved(Location((0, 0, LOWER_SEAT_MM + (4 if exploded else 0))))
                for part in coupon()]
    return [nest_body(), *specimen, bridge(-MOUNT_X_MM, rise + (5 if exploded else 0)),
            bridge(MOUNT_X_MM, rise + (5 if exploded else 0))]


def verify(parts, expected_solid_count):
    assert len(parts) == expected_solid_count
    assert all(part.is_valid and len(part.solids()) == 1 for part in parts)
    for index, left in enumerate(parts):
        for right in parts[index + 1:]:
            intersection = left.intersect(right)
            if intersection:
                assert sum(shape.volume for shape in intersection) < 1e-6, (left.label, right.label)


def write_models(folder):
    for filename, parts in [("eca-pcb-coupon", coupon()), ("eca-handling-nest", fixture())]:
        verify(parts, len(parts))
        assembly = Compound(label=filename, children=parts)
        filename = folder / f"{filename}.step"
        assert export_step(assembly, filename)
        recovered = import_step(filename)
        assert recovered.is_valid and len(recovered.solids()) == len(parts)
        print(f"{filename.name}: {len(parts)} valid solids, no volumetric clashes, STEP round-trip")
    base = build()
    bbox = base.bounding_box().size
    assert all(abs(a - b) < 1e-8 for a, b in zip(bbox, (NEST_L_MM, NEST_W_MM, NEST_H_MM)))
    for check in checks():
        overlap = base.intersect(check["shape"])
        assert not overlap or sum(shape.volume for shape in overlap) < 1e-6, check["label"]
    for x in [-MOUNT_X_MM, MOUNT_X_MM]:
        for y in [-MOUNT_Y_MM, MOUNT_Y_MM]:
            gauge = bore(x, y, 0, NEST_H_MM)
            overlap = base.intersect(gauge)
            assert not overlap or sum(shape.volume for shape in overlap) < 1e-6
    print("Nest base: envelope, coupon seats, center window and through bores checked")


if __name__ == "__main__":
    from argparse import ArgumentParser
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    write_models(args.output)
