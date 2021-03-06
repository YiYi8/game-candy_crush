namespace ui {
	export class MeshUI extends layer.ui.Sprite {
		private mesh: Mesh;
		private cellWidth: number;
		private cellHeight: number;
		private touchCell: CellUI;

		constructor(mesh: Mesh) {
			super();
			this.mesh = mesh;

			this.touchEnabled = true;
			this.mesh.createMesh();
		}

		public onAddedToStage(e: egret.Event): void
		{
			if (this.width <=0 || this.height <= 0)
				throw new Error('MeshUI Set width/height first');

			this.cellWidth = this.width / this.mesh.cols;
			this.cellHeight = this.height / this.mesh.rows;

			this.addEventListener(egret.TouchEvent.TOUCH_BEGIN, this.onTouchBegin, this);
			this.addEventListener(egret.TouchEvent.TOUCH_MOVE, this.onTouchMove, this);
			this.addEventListener(egret.TouchEvent.TOUCH_END, this.onTouchEnd, this);
			this.addEventListener(egret.TouchEvent.TOUCH_RELEASE_OUTSIDE, this.onTouchOut, this);

			this.renderMesh();
		}

		public onRemovedFromStage(e: egret.Event): void
		{
			this.removeAllEventListeners();
		}

		public removeAllEventListeners(): void
		{
			this.removeEventListener(egret.TouchEvent.TOUCH_BEGIN, this.onTouchBegin, this);
			this.removeEventListener(egret.TouchEvent.TOUCH_MOVE, this.onTouchMove, this);
			this.removeEventListener(egret.TouchEvent.TOUCH_END, this.onTouchEnd, this);
			this.removeEventListener(egret.TouchEvent.TOUCH_RELEASE_OUTSIDE, this.onTouchOut, this);
		}

		public onTouchBegin(event: egret.TouchEvent) {
			this.touchCell = this.hitCellUI(event.stageX, event.stageY);
			if (this.touchCell)
				this.touchCell.onTouchBegin(event);
		}

		public onTouchMove(event: egret.TouchEvent) {
			if (this.touchCell)
			{
				let currentCell: CellUI = this.hitCellUI(event.stageX, event.stageY);
				if (!currentCell || this.touchCell != currentCell) //不在本CELL内，移出去了
				{
					this.touchCell.onTouchEnd(event);
					this.touchCell = null; //没有Tap事件了
				}
			}
		}

		public onTouchEnd(event: egret.TouchEvent) {
			if (this.touchCell)
			{
				let currentCell: CellUI = this.hitCellUI(event.stageX, event.stageY);
				if (this.touchCell == currentCell) { //相同，则是Tap点击
					this.touchCell.onTouchTap(event);
				} else {
					this.touchCell.onTouchEnd(event);
				}
				this.touchCell = null;
			}
		}

		public onTouchOut(event: egret.TouchEvent) {
			if (this.touchCell)
				this.touchCell.onTouchEnd(event);
		}

		protected hitCellUI(x: number, y: number) : CellUI | null
		{
			for (let i: number = 0; i < this.numChildren;++i)
			{
				let node: egret.DisplayObject = this.getChildAt(i);
				if (node.name == 'cell')
				{
					let cellUI: CellUI = node as CellUI;
					if (!cellUI.cell.block && cellUI.visible && cellUI.hitTestPoint(x, y))
						return cellUI;
				}
			}
			return null;
		}

		public getCellRectangle(rowOrIndex: number, col?: number) : egret.Rectangle
		{
			let position: egret.Point = this.getCellPoint(rowOrIndex, col);
			return new egret.Rectangle(
				position.x,
				position.y,
				this.cellWidth,
				this.cellHeight
			);
		}

		public getCellPoint(rowOrIndex: number, col?: number) : egret.Point
		{
			let row: number = rowOrIndex;
			if (col == null)
			{
				row = this.mesh.row(rowOrIndex);
				col = this.mesh.col(rowOrIndex);
			}
			return new egret.Point(
				this.cellWidth * col,
				this.cellHeight * row,
			);
		}

		public createCellUI(cell: Cell, rect: egret.Rectangle) : CellUI
		{
			let cellUI: CellUI = new CellUI(cell);
			cellUI.x = rect.x;
			cellUI.y = rect.y;
			cellUI.width = rect.width;
			cellUI.height = rect.height;
			cellUI.name = "cell";
			return cellUI;
		}

		public renderMesh() : void
		{
			this.removeChildren();

			for(let row of this.mesh.rowsEntries()) {
				for(let col of this.mesh.colsEntries()) {
					let cellUI: CellUI = this.createCellUI(this.mesh.cell(row, col), this.getCellRectangle(row, col));
					this.addChild(cellUI);
				}
			}
		}

		public renderSwap(fromCell: Cell, toCell:Cell, swapBack:boolean) : Promise<any>
		{
			let fromCellUI: CellUI = this.getChildByCellIndex(fromCell.index) as CellUI;
			let toCellUI: CellUI = this.getChildByCellIndex(toCell.index) as CellUI;
			console.log('swap: ', fromCell.index, toCell.index);

			let promises : Promise<any>[] = [];
			if (swapBack)
			{
				promises.push(fromCellUI.moveTo(200, this.getCellPoint(toCell.index), this.getCellPoint(fromCell.index)));
				promises.push(toCellUI.moveTo(200, this.getCellPoint(fromCell.index), this.getCellPoint(toCell.index)));
			} else {
				promises.push(fromCellUI.moveTo(200, this.getCellPoint(fromCell.index)));
				promises.push(toCellUI.moveTo(200, this.getCellPoint(toCell.index)));
			}
			return Promise.all(promises);
		}

		public renderCross(row: number = -1, col: number = -1) {
			let rect: egret.Rectangle = this.getCellRectangle(this.mesh.index(row < 0 ? 0 : row, col < 0 ? 0 : col));
			let crossUI = row >= 0 ? new CrossRowUI(rect) : new CrossColUI(rect);
			this.addChild(crossUI);
			return crossUI.fadeOut(400); //十字架时间长一点
		}

		public renderCrush(crushedCells: CrushedCells) : Promise<any>
		{
			let promises : Promise<any>[] = [];

			//十字行
			for(let row of crushedCells.crosses.rows) {
				this.mesh.rowIndices(row, true).forEach(index => {
					let cellUI: CellUI = this.getChildByCellIndex(index) as CellUI;
					if (cellUI) cellUI.destroy();
				});
				promises.push(this.renderCross(row));
			}
			//十字列
			for(let col of crushedCells.crosses.cols) {
				this.mesh.colIndices(col, true).forEach(index => {
					let cellUI: CellUI = this.getChildByCellIndex(index) as CellUI;
					if (cellUI) cellUI.destroy();
				});
				promises.push(this.renderCross(-1, col));
			}

			if (crushedCells.hasCrosses)
			{
				switch (crushedCells.crosses.rows.length + crushedCells.crosses.cols.length) {
					case 1:
						layer.media.Sound.play('line_mp3');
						break;
					case 2:
						layer.media.Sound.play('line1_mp3');
						break;
					case 3:
					default:
						layer.media.Sound.play('line2_mp3');
						break;
				}
			}

			//移除其它cells
			for(let index of crushedCells.cellIndices(false))
			{
				let cellUI: CellUI = this.getChildByCellIndex(index) as CellUI;
				if (cellUI) promises.push(cellUI.fadeOut(300).then(() => {
					cellUI.destroy();
				})); //消失且移除
			}
			return Promise.all(promises);
		}

		public renderFill(filledCells:FilledCells) : Promise<any> {
			let promises: Promise<any>[] = [];
			for(let group of filledCells.fills)
			{
				if (!group.creating) {
					let cellUI: CellUI = this.getChildByCellIndex(group.toIndex);
					if (cellUI)
						promises.push(cellUI.moveTo(group.delta * 50, this.getCellPoint(group.toIndex)));
				} else {
					let rect:egret.Rectangle = this.getCellRectangle(group.delta - this.mesh.row(group.toIndex), this.mesh.col(group.toIndex));
					rect.y = -rect.y;
					let cellUI: CellUI = this.createCellUI(this.mesh.cell(group.toIndex), rect);
					this.addChild(cellUI);

					promises.push(cellUI.moveTo(group.delta * 50, this.getCellPoint(group.toIndex)));
				}
			}

			return Promise.all(promises);
		}

		public getChildByCellIndex(index: number) : CellUI|null {
			for (let i = 0; i < this.numChildren; i++) {
				let element: CellUI = this.getChildAt(i) as CellUI;
				if (element.name != 'cell') continue;
				if (element.cell && element.cell.index == index)
					return element;
			}
			return null;
		}

		public clearSelected() : void {
			for (let i = 0; i < this.numChildren; i++) {
				let element: CellUI = this.getChildAt(i) as CellUI;
				element.selected = false;
			}
		}

		public select(cell: Cell) : void {
			this.clearSelected();
			if (!cell) return;
			let element: CellUI = this.getChildByCellIndex(cell.index);
			if (element instanceof CellUI)
				element.selected = true;
		}

	}
}
